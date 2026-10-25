// Canvas map of the Nitra region drawn from real boundaries (public/geo/nitra.json, from
// geoBoundaries with Wikidata names). One projection and fit for every size, so the region keeps
// its true outline. Ported from designs/homepage/map.js ("Hranice": obec and okres borders with
// a glowing region outline). Colours come from CSS tokens --bg and --map-*.

export interface GeoData {
  source: string;
  okresy: { name: string; km2: number; rings: [number, number][][][] }[];
  obce: {
    name: string;
    okres: string;
    c: [number, number];
    km2: number;
    rings: [number, number][][][];
  }[];
}

type Pt = [number, number];
type Poly = Pt[][];
interface Shape {
  name: string;
  km2: number;
  polys: Poly[];
  bb: [number, number, number, number];
}
interface Obec extends Shape {
  okres: string;
  c: Pt;
}

export interface MapOptions {
  pad?: number;
  alignX?: number;
  alignY?: number;
  glow?: boolean;
  labels?: boolean;
  font?: string;
  labelFont?: string;
  onHover?: (okres: string | null, obec: string | null) => void;
  onClick?: (okres: string | null, obec: string | null) => void;
}

export interface MapApi {
  hover(okres: string | null): void;
  pin(obec: string | null): void;
  focus(okres: string | null): void;
  seatPx(okres: string): Pt | null;
  obecPx(name: string): Pt | null;
  obec(name: string): Obec | null;
  size(): Pt;
  destroy(): void;
}

const K = Math.cos((48.2 * Math.PI) / 180);
const P = ([lon, lat]: Pt): Pt => [lon * K, -lat];

function bbox(polys: Poly[]): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of polys)
    for (const [x, y] of p[0] ?? []) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return [x0, y0, x1, y1];
}

function inRing(r: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!,
      [xj, yj] = r[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      c = !c;
  }
  return c;
}

function inShape(sh: Shape, x: number, y: number): boolean {
  return (
    x >= sh.bb[0] &&
    x <= sh.bb[2] &&
    y >= sh.bb[1] &&
    y <= sh.bb[3] &&
    sh.polys.some(
      (p) => inRing(p[0]!, x, y) && !p.slice(1).some((h) => inRing(h, x, y)),
    )
  );
}

export function createMap(
  canvas: HTMLCanvasElement,
  geo: GeoData,
  options: MapOptions = {},
): MapApi {
  const o = {
    pad: 0.05,
    alignX: 0.5,
    alignY: 0.5,
    glow: true,
    labels: true,
    font: "ui-monospace, Menlo, monospace",
    labelFont: "system-ui, sans-serif",
    ...options,
  };
  const OKR: Shape[] = geo.okresy.map((d) => {
    const polys = d.rings.map((p) => p.map((r) => r.map(P)));
    return { name: d.name, km2: d.km2, polys, bb: bbox(polys) };
  });
  const OBC: Obec[] = geo.obce.map((d) => {
    const polys = d.rings.map((p) => p.map((r) => r.map(P)));
    return {
      name: d.name,
      okres: d.okres,
      km2: d.km2,
      c: P(d.c),
      polys,
      bb: bbox(polys),
    };
  });
  const OBC_BY = new Map(OBC.map((d) => [d.name, d]));
  // District seats share the district's name, except where two obce share one (none in Nitra).
  const SEAT = new Map(
    OKR.map((d) => [
      d.name,
      OBC.find((b) => b.name === d.name && b.okres === d.name),
    ]),
  );
  const all = OKR.flatMap((d) => d.polys);
  const [BX0, BY0, BX1, BY1] = bbox(all);
  const okresAt = (x: number, y: number) =>
    OKR.find((d) => inShape(d, x, y))?.name ?? null;

  const ctx = canvas.getContext("2d")!;
  let W = 0,
    H = 0,
    s = 1,
    ox = 0,
    oy = 0;
  const col: Record<string, string> = {};
  let okPath = new Map<string, Path2D>(),
    obPath = new Map<string, Path2D>(),
    region = new Path2D();
  let hoverOk: string | null = null,
    hoverOb: string | null = null,
    focusOk: string | null = null,
    pinned: { name: string; c: Pt; t0: number } | null = null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let alive = true;

  const px = (x: number, y: number): Pt => [x * s + ox, y * s + oy];
  const unpx = (x: number, y: number): Pt => [(x - ox) / s, (y - oy) / s];

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ["dot", "edge", "hi", "label", "plate", "plate-fg"])
      col[k] = cs.getPropertyValue("--map-" + k).trim();
    col.bg = cs.getPropertyValue("--bg").trim();
  }

  function path(polys: Poly[]): Path2D {
    const p = new Path2D();
    for (const poly of polys)
      for (const ring of poly)
        ring.forEach(([x, y], i) => {
          const [a, b] = px(x, y);
          if (i) p.lineTo(a, b);
          else p.moveTo(a, b);
        });
    return p;
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    if (!W || !H) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = Math.max(18, W * o.pad),
      mw = BX1 - BX0,
      mh = BY1 - BY0;
    s = Math.min((W - pad * 2) / mw, (H - pad * 2 - 18) / mh);
    ox = pad + (W - pad * 2 - mw * s) * o.alignX - BX0 * s;
    oy = pad + (H - pad * 2 - 18 - mh * s) * o.alignY - BY0 * s;
    okPath = new Map(OKR.map((d) => [d.name, path(d.polys)]));
    obPath = new Map(OBC.map((d) => [d.name, path(d.polys)]));
    region = path(all);
    draw(performance.now());
  }

  function round(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function plateLabel(str: string, x: number, y: number, on: boolean) {
    ctx.font =
      (on ? "500 " : "400 ") +
      Math.max(11, Math.min(13, W / 60)) +
      "px " +
      o.font;
    const w = ctx.measureText(str).width + 12;
    ctx.globalAlpha = on ? 1 : 0.82;
    ctx.fillStyle = on ? col.plate! : col["plate-fg"]!;
    round(x - 1, y - 10, w, 19, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = on ? col["plate-fg"]! : col.label!;
    ctx.fillText(str, x + 5, y + 4);
  }

  function draw(t: number) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const a = hoverOk || focusOk;
    const lo = hoverOb || pinned?.name || null;
    const aPath = a ? okPath.get(a) : undefined;
    const loPath = lo ? obPath.get(lo) : undefined;
    if (aPath) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = col.hi!;
      ctx.fill(aPath);
    }
    if (loPath) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = col.hi!;
      ctx.fill(loPath);
    }
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col.dot!;
    ctx.lineWidth = 0.7;
    for (const p of obPath.values()) ctx.stroke(p);
    ctx.strokeStyle = col.label!;
    ctx.lineWidth = 1.3;
    for (const p of okPath.values()) ctx.stroke(p);
    if (o.glow) {
      ctx.save();
      ctx.shadowColor = col.hi!;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = col.hi!;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.4;
      ctx.stroke(region);
      ctx.restore();
    }
    if (aPath) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col.hi!;
      ctx.lineWidth = 2;
      ctx.stroke(aPath);
    }
    ctx.globalAlpha = 1;
    if (o.labels) {
      for (const [ok, c] of SEAT) {
        // A pinned district town carries its own label.
        if (!c || c.name === pinned?.name) continue;
        const [x, y] = px(...c.c);
        plateLabel(ok, x + 6, y, a === ok);
      }
      ctx.font = "400 11px " + o.font;
      ctx.fillStyle = col.label!;
      ctx.globalAlpha = 0.8;
      {
        const [x, y] = px(...P([18.33, 47.705]));
        ctx.fillText("DUNAJ", x, y);
      }
      {
        ctx.save();
        const [x, y] = px(...P([19.0, 47.94]));
        ctx.translate(x, y);
        ctx.rotate(-1.05);
        ctx.fillText("IPEĽ", 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (pinned) {
      const [x, y] = px(...pinned.c);
      for (let k = 0; k < 2; k++) {
        const ph = reduce ? 0.5 : ((t - pinned.t0) / 1800 + k / 2) % 1;
        ctx.strokeStyle = col.hi!;
        ctx.globalAlpha = (1 - ph) * 0.6;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 6 + ph * 34, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.hi!;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 6.2832);
      ctx.fill();
      ctx.font = "500 13px " + o.labelFont;
      const w = ctx.measureText(pinned.name).width + 16,
        lx = Math.min(x + 14, W - w - 4),
        ly = y + 14 + 24 > H ? y - 38 : y + 14;
      ctx.fillStyle = col.plate!;
      round(lx, ly, w, 24, 12);
      ctx.fill();
      ctx.fillStyle = col["plate-fg"]!;
      ctx.fillText(pinned.name, lx + 8, ly + 16.5);
    }
  }

  // Only a pinned obec animates (its pulse); otherwise the map redraws on change.
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
  });
  io.observe(canvas);
  function loop(t: number) {
    if (!alive) return;
    if (pinned && visible && !document.hidden && !reduce) draw(t);
    raf = requestAnimationFrame(loop);
  }
  const redraw = () => draw(performance.now());
  const report = () =>
    o.onHover?.(hoverOk || focusOk, hoverOb || pinned?.name || null);

  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    const [x, y] = unpx(e.clientX - r.left, e.clientY - r.top);
    const ok = okresAt(x, y);
    const ob = ok
      ? (OBC.find((d) => d.okres === ok && inShape(d, x, y))?.name ?? null)
      : null;
    if (ok === hoverOk && ob === hoverOb) return;
    hoverOk = ok;
    hoverOb = ob;
    redraw();
    report();
  }
  function onLeave() {
    hoverOk = hoverOb = null;
    redraw();
    report();
  }
  function onClick() {
    if (hoverOb || hoverOk) o.onClick?.(hoverOk, hoverOb);
  }
  if (o.onHover || o.onClick) {
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
  }

  readColors();
  const ro = new ResizeObserver(layout);
  ro.observe(canvas);
  document.fonts?.ready.then(() => alive && redraw());
  raf = requestAnimationFrame(loop);

  return {
    hover(ok) {
      hoverOk = ok;
      hoverOb = null;
      redraw();
      report();
    },
    pin(name) {
      const ob = name ? OBC_BY.get(name) : undefined;
      pinned = ob ? { name: ob.name, c: ob.c, t0: performance.now() } : null;
      focusOk = ob ? ob.okres : focusOk;
      redraw();
    },
    focus(ok) {
      focusOk = ok;
      redraw();
    },
    seatPx: (ok) => {
      const c = SEAT.get(ok);
      return c ? px(...c.c) : null;
    },
    obecPx: (name) => {
      const c = OBC_BY.get(name);
      return c ? px(...c.c) : null;
    },
    obec: (name) => OBC_BY.get(name) ?? null,
    size: () => [W, H],
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    },
  };
}

let geoPromise: Promise<GeoData> | null = null;

/** The geometry is static and shared by every map on a page. */
export function loadGeo(): Promise<GeoData> {
  geoPromise ??= fetch("/geo/nitra.json").then(
    (r) => r.json() as Promise<GeoData>,
  );
  return geoPromise;
}
