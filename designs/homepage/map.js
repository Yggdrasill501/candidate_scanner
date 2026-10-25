/* Nitra region map drawn from real boundaries (geo.js), for the round-4 variants of draft A.
   Every mode uses the same projection and fit, so the region keeps one accurate outline and size.
   Modes: obce, dots, hex, area, borders, dither, topo, ascii, lines.
   Colours come from CSS tokens on :root: --bg, --map-dot, --map-edge, --map-hi, --map-label,
   --map-plate, --map-plate-fg. */
(function () {
  const G = window.KVGEO;
  const K = Math.cos((48.2 * Math.PI) / 180);
  const P = ([lon, lat]) => [lon * K, -lat];
  const KM = 1 / 111.32; // degrees of latitude per km

  const bbox = (polys) => {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const p of polys)
      for (const [x, y] of p[0]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    return [x0, y0, x1, y1];
  };
  function inRing(r, x, y) {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i],
        [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        c = !c;
    }
    return c;
  }
  const inShape = (sh, x, y) =>
    x >= sh.bb[0] &&
    x <= sh.bb[2] &&
    y >= sh.bb[1] &&
    y <= sh.bb[3] &&
    sh.polys.some(
      (p) => inRing(p[0], x, y) && !p.slice(1).some((h) => inRing(h, x, y)),
    );

  const OKR = G.okresy.map((o) => {
    const polys = o.rings.map((p) => p.map((r) => r.map(P)));
    return { name: o.name, km2: o.km2, polys, bb: bbox(polys) };
  });
  const OBC = G.obce.map((o) => {
    const polys = o.rings.map((p) => p.map((r) => r.map(P)));
    return {
      name: o.name,
      okres: o.okres,
      km2: o.km2,
      c: P(o.c),
      polys,
      bb: bbox(polys),
    };
  });
  const OBC_BY = Object.fromEntries(OBC.map((o) => [o.name, o]));
  const okresAt = (x, y) => {
    for (const o of OKR) if (inShape(o, x, y)) return o.name;
    return null;
  };

  const all = OKR.flatMap((o) => o.polys);
  const [BX0, BY0, BX1, BY1] = bbox(all);

  // hex-offset grid, ≈ 2.5 km between points
  const STEP = 0.0225,
    ROW = STEP * 0.866;
  const GRID = [],
    at = new Map();
  for (let y = BY0, r = 0; y <= BY1; y += ROW, r++) {
    for (
      let x = BX0 + (r % 2 ? STEP / 2 : 0), i = 0;
      x <= BX1;
      x += STEP, i++
    ) {
      const ok = okresAt(x, y);
      if (!ok) continue;
      const cell = { px: x, py: y, r, i, ok, edge: false };
      GRID.push(cell);
      at.set(r + ":" + i, cell);
    }
  }
  // a cell sits on an inner district border when a neighbour belongs to another okres
  for (const c of GRID) {
    const d =
      c.r % 2
        ? [
            [0, -1],
            [0, 1],
            [-1, 0],
            [-1, 1],
            [1, 0],
            [1, 1],
          ]
        : [
            [0, -1],
            [0, 1],
            [-1, -1],
            [-1, 0],
            [1, -1],
            [1, 0],
          ];
    c.edge = d.some(([dr, di]) => {
      const n = at.get(c.r + dr + ":" + (c.i + di));
      return n && n.ok !== c.ok;
    });
  }
  // horizontal runs for "lines", split where the okres changes
  const RUNS = [];
  for (let y = BY0 + ROW / 2; y <= BY1; y += ROW) {
    let cur = null;
    for (let x = BX0; x <= BX1 + STEP / 6; x += STEP / 6) {
      const ok = okresAt(x, y);
      if (cur && cur.ok === ok) {
        cur.x1 = x;
        continue;
      }
      if (cur) RUNS.push(cur);
      cur = ok ? { py: y, x0: x, x1: x, ok } : null;
    }
    if (cur) RUNS.push(cur);
  }

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
    (v) => (v + 0.5) / 16,
  );
  const RAMP = ".:-=+*#";
  const ANIMATED = {
    obce: true,
    dots: true,
    hex: true,
    area: true,
    borders: false,
    dither: true,
    topo: false,
    ascii: true,
    lines: true,
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rgb(str) {
    const s = str.trim();
    if (s[0] === "#") {
      const h =
        s.length === 4
          ? s
              .slice(1)
              .split("")
              .map((c) => c + c)
              .join("")
          : s.slice(1, 7);
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const m = s.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
  }

  window.KVMap = function (canvas, options) {
    const o = Object.assign(
      {
        mode: "obce",
        pad: 0.05,
        alignX: 0.5,
        alignY: 0.5,
        glow: true,
        font: "ui-monospace, Menlo, monospace",
        labelFont: "system-ui, sans-serif",
        onHover: null,
        onClick: null,
      },
      options || {},
    );
    const ctx = canvas.getContext("2d");
    const SEAT = Object.fromEntries(OKR.map((d) => [d.name, OBC_BY[d.name]]));
    let W = 0,
      H = 0,
      s = 1,
      ox = 0,
      oy = 0,
      col = {};
    let okPath = {},
      obPath = {},
      region = null;
    let hoverOk = null,
      hoverOb = null,
      focusOk = null,
      pin = null,
      chosen = null;
    let dith = null;

    const px = (x, y) => [x * s + ox, y * s + oy];
    const unpx = (x, y) => [(x - ox) / s, (y - oy) / s];

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      for (const k of ["dot", "edge", "hi", "label", "plate", "plate-fg"])
        col[k] = cs.getPropertyValue("--map-" + k).trim();
      col.bg = cs.getPropertyValue("--bg").trim();
      dith = null;
    }

    function path(polys) {
      const p = new Path2D();
      for (const poly of polys)
        for (const ring of poly)
          ring.forEach(([x, y], i) => {
            const [a, b] = px(x, y);
            i ? p.lineTo(a, b) : p.moveTo(a, b);
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
      okPath = Object.fromEntries(OKR.map((d) => [d.name, path(d.polys)]));
      obPath = Object.fromEntries(OBC.map((d) => [d.name, path(d.polys)]));
      region = path(all);
      dith = null;
      draw(performance.now());
    }

    const wave = (x, y, t) =>
      reduce ? 0 : Math.sin(t / 1100 + (x * 0.7 + y) / 46);
    const act = () => hoverOk || focusOk;
    const litOb = () => hoverOb || (pin && pin.name);

    // ---- renderers -------------------------------------------------------
    const R = {
      obce(t) {
        const a = act(),
          lo = litOb();
        ctx.lineJoin = "round";
        for (const d of OBC) {
          const [cx, cy] = px(...d.c),
            on = a === d.okres;
          ctx.globalAlpha =
            (on ? 0.5 : 0.72 + 0.28 * wave(cx, cy, t)) * (a && !on ? 0.7 : 1);
          ctx.fillStyle = on ? col.hi : col.dot;
          ctx.fill(obPath[d.name]);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col.bg;
        ctx.lineWidth = 1.1;
        for (const d of OBC) ctx.stroke(obPath[d.name]);
        ctx.lineWidth = 2.2;
        for (const d of OKR) ctx.stroke(okPath[d.name]);
        if (lo && obPath[lo]) {
          ctx.fillStyle = col.hi;
          ctx.fill(obPath[lo]);
        }
      },
      dots(t) {
        const a = act(),
          r0 = STEP * s * 0.3;
        for (const d of GRID) {
          const [x, y] = px(d.px, d.py),
            on = a === d.ok;
          const r =
            r0 *
            (d.edge ? 0.5 : 1) *
            (1 + 0.16 * wave(x, y, t)) *
            (on ? 1.3 : 1);
          if (on && o.glow) {
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = col.hi;
            ctx.beginPath();
            ctx.arc(x, y, r * 2.6, 0, 6.2832);
            ctx.fill();
          }
          ctx.globalAlpha = a && !on ? 0.7 : 1;
          ctx.fillStyle = on ? col.hi : d.edge ? col.edge : col.dot;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 6.2832);
          ctx.fill();
        }
      },
      hex(t) {
        const a = act(),
          rr = (STEP * s) / Math.sqrt(3);
        for (const d of GRID) {
          const [x, y] = px(d.px, d.py),
            on = a === d.ok;
          ctx.globalAlpha =
            (d.edge ? 0.55 : 0.82 + 0.18 * wave(x, y, t)) *
            (a && !on ? 0.75 : 1);
          ctx.fillStyle = on ? col.hi : d.edge ? col.edge : col.dot;
          ctx.beginPath();
          const k = rr * (d.edge ? 0.62 : on ? 0.9 : 0.84);
          for (let i = 0; i < 6; i++) {
            const an = (Math.PI / 3) * i + Math.PI / 6;
            i
              ? ctx.lineTo(x + k * Math.cos(an), y + k * Math.sin(an))
              : ctx.moveTo(x + k * Math.cos(an), y + k * Math.sin(an));
          }
          ctx.closePath();
          ctx.fill();
        }
      },
      area(t) {
        // a circle with the same area as each obec, centred on it
        const a = act(),
          lo = litOb();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = col.edge;
        ctx.lineWidth = 1;
        for (const d of OKR) ctx.stroke(okPath[d.name]);
        for (const d of OBC) {
          const [x, y] = px(...d.c),
            on = a === d.okres;
          const r =
            Math.sqrt(d.km2 / Math.PI) * KM * s * (1 + 0.04 * wave(x, y, t));
          ctx.globalAlpha = (on ? 0.85 : 0.55) * (a && !on ? 0.75 : 1);
          ctx.fillStyle = on ? col.hi : col.dot;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 6.2832);
          ctx.fill();
          if (d.name === lo) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = col.hi;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      },
      borders() {
        const a = act(),
          lo = litOb();
        if (a) {
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = col.hi;
          ctx.fill(okPath[a]);
        }
        if (lo && obPath[lo]) {
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = col.hi;
          ctx.fill(obPath[lo]);
        }
        ctx.lineJoin = "round";
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col.dot;
        ctx.lineWidth = 0.7;
        for (const d of OBC) ctx.stroke(obPath[d.name]);
        ctx.strokeStyle = col.label;
        ctx.lineWidth = 1.3;
        for (const d of OKR) ctx.stroke(okPath[d.name]);
        if (o.glow) {
          ctx.save();
          ctx.shadowColor = col.hi;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = col.hi;
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 1.4;
          ctx.stroke(region);
          ctx.restore();
        }
        if (a) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = col.hi;
          ctx.lineWidth = 2;
          ctx.stroke(okPath[a]);
        }
      },
      dither(t) {
        const cell = 3,
          w = Math.ceil(W / cell),
          h = Math.ceil(H / cell);
        if (!dith || dith.w !== w || dith.h !== h) {
          // rasterise district membership once per size: R channel = okres index + 1
          const m = document.createElement("canvas");
          m.width = w;
          m.height = h;
          const mc = m.getContext("2d");
          mc.setTransform(1 / cell, 0, 0, 1 / cell, 0, 0);
          OKR.forEach((d, i) => {
            mc.fillStyle = "rgb(" + (i + 1) * 30 + ",0,0)";
            mc.fill(okPath[d.name]);
          });
          const src = mc.getImageData(0, 0, w, h).data,
            idx = new Int8Array(w * h).fill(-1);
          for (let p = 0; p < w * h; p++)
            if (src[p * 4 + 3] > 200) idx[p] = Math.round(src[p * 4] / 30) - 1;
          const edge = new Uint8Array(w * h);
          for (let y = 1; y < h - 1; y++)
            for (let x = 1; x < w - 1; x++) {
              const p = y * w + x,
                v = idx[p];
              if (
                v >= 0 &&
                ((idx[p + 1] >= 0 && idx[p + 1] !== v) ||
                  (idx[p + w] >= 0 && idx[p + w] !== v))
              )
                edge[p] = 1;
            }
          const out = document.createElement("canvas");
          out.width = w;
          out.height = h;
          dith = {
            w,
            h,
            idx,
            edge,
            out,
            oc: out.getContext("2d"),
            img: null,
            dot: rgb(col.label),
            hi: rgb(col.hi),
          };
          dith.img = dith.oc.createImageData(w, h);
        }
        const a = act(),
          ai = a ? OKR.findIndex((d) => d.name === a) : -2;
        const { w: dw, h: dh, idx, edge, img, dot, hi } = dith,
          data = img.data,
          tt = reduce ? 0 : t / 1400;
        // slow light that drifts across the region
        const lx = dw * (0.5 + 0.35 * Math.cos(tt * 0.6)),
          ly = dh * (0.4 + 0.3 * Math.sin(tt * 0.6));
        const R2 = (Math.max(dw, dh) * 0.55) ** 2;
        for (let y = 0; y < dh; y++)
          for (let x = 0; x < dw; x++) {
            const p = y * dw + x,
              v = idx[p],
              q = p * 4;
            if (v < 0 || edge[p]) {
              data[q + 3] = 0;
              continue;
            }
            const on = v === ai;
            const light =
              0.12 +
              0.55 * Math.max(0, 1 - ((x - lx) ** 2 + (y - ly) ** 2) / R2) +
              (on ? 0.38 : 0) -
              (a && !on ? 0.06 : 0);
            if (light > BAYER[(y & 3) * 4 + (x & 3)]) {
              const c = on ? hi : dot;
              data[q] = c[0];
              data[q + 1] = c[1];
              data[q + 2] = c[2];
              data[q + 3] = on ? 255 : 170;
            } else data[q + 3] = 0;
          }
        dith.oc.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(dith.out, 0, 0, dw * cell, dh * cell);
        ctx.imageSmoothingEnabled = true;
      },
      topo() {
        // contour rings inside every obec: the outer ring is the true border
        const a = act(),
          lo = litOb();
        ctx.lineJoin = "round";
        for (const d of OBC) {
          const on = a === d.okres || d.name === lo,
            [cx, cy] = px(...d.c),
            p = obPath[d.name];
          for (const [k, al] of [
            [1, 0.9],
            [0.66, 0.6],
            [0.36, 0.4],
          ]) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(k, k);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha = al * (a && !on ? 0.65 : 1);
            ctx.strokeStyle = d.name === lo ? col.hi : on ? col.hi : col.dot;
            ctx.lineWidth = (k === 1 ? 0.9 : 0.8) / k;
            ctx.stroke(p);
            ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col.label;
        ctx.lineWidth = 1.3;
        for (const d of OKR) ctx.stroke(okPath[d.name]);
      },
      ascii(t) {
        const a = act(),
          size = STEP * s * 1.05;
        ctx.font = "500 " + size.toFixed(1) + "px " + o.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const d of GRID) {
          const [x, y] = px(d.px, d.py),
            on = a === d.ok,
            w = (wave(x, y, t) + 1) / 2;
          const ch = d.edge
            ? "·"
            : on
              ? w > 0.5
                ? "#"
                : "*"
              : RAMP[1 + Math.round(w * (RAMP.length - 3))];
          ctx.globalAlpha = on ? 1 : (d.edge ? 0.35 : 0.5) * (a ? 0.75 : 1);
          ctx.fillStyle = on ? col.hi : col.label;
          ctx.fillText(ch, x, y);
        }
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      },
      lines(t) {
        const a = act(),
          lw = Math.max(1.2, STEP * s * 0.22);
        ctx.lineCap = "round";
        for (const r of RUNS) {
          const on = a === r.ok,
            [x0, y] = px(r.x0, r.py),
            [x1] = px(r.x1, r.py);
          ctx.globalAlpha = a && !on ? 0.6 : 1;
          ctx.strokeStyle = on ? col.hi : col.dot;
          ctx.lineWidth = on ? lw * 1.7 : lw;
          const amp = STEP * s * (on ? 0.32 : 0.12);
          ctx.beginPath();
          for (let x = x0; x <= x1 + 0.1; x += 5) {
            const yy = y + amp * wave(x * 1.8, y, t);
            x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(Math.min(x, x1), yy);
          }
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      },
    };

    function plateLabel(str, x, y, on) {
      ctx.font =
        (on ? "500 " : "400 ") +
        Math.max(11, Math.min(13, W / 60)) +
        "px " +
        o.font;
      const w = ctx.measureText(str).width + 12;
      ctx.globalAlpha = on ? 1 : 0.82;
      ctx.fillStyle = on ? col.plate : col["plate-fg"];
      round(x - 1, y - 10, w, 19, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = on ? col["plate-fg"] : col.label;
      ctx.fillText(str, x + 5, y + 4);
    }
    function round(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function draw(t) {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      (R[o.mode] || R.obce)(t);
      ctx.globalAlpha = 1;
      const a = act();
      for (const [ok, c] of Object.entries(SEAT)) {
        if (!c) continue;
        const [x, y] = px(...c.c);
        plateLabel(ok, x + 6, y, a === ok);
      }
      ctx.font = "400 11px " + o.font;
      ctx.fillStyle = col.label;
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
      if (pin) {
        const [x, y] = px(...pin.c);
        for (let k = 0; k < 2; k++) {
          const ph = reduce ? 0.5 : ((t - pin.t0) / 1800 + k / 2) % 1;
          ctx.strokeStyle = col.hi;
          ctx.globalAlpha = (1 - ph) * 0.6;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y, 6 + ph * 34, 0, 6.2832);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = col.hi;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 6.2832);
        ctx.fill();
        ctx.font = "500 13px " + o.labelFont;
        const w = ctx.measureText(pin.name).width + 16,
          lx = Math.min(x + 14, W - w - 4),
          ly = y - 32;
        ctx.fillStyle = col.plate;
        round(lx, ly, w, 24, 12);
        ctx.fill();
        ctx.fillStyle = col["plate-fg"];
        ctx.fillText(pin.name, lx + 8, ly + 16.5);
      }
    }

    let visible = true;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    }).observe(canvas);
    function loop(t) {
      if (visible && !document.hidden && ANIMATED[o.mode] && !reduce) draw(t);
      requestAnimationFrame(loop);
    }
    const redraw = () => {
      if (reduce || !ANIMATED[o.mode]) draw(performance.now());
    };
    const report = () => {
      if (o.onHover)
        o.onHover(hoverOk || focusOk, hoverOb || (pin && pin.name) || null);
    };

    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect(),
        [x, y] = unpx(e.clientX - r.left, e.clientY - r.top);
      const ok = okresAt(x, y);
      const ob = ok
        ? OBC.find((d) => d.okres === ok && inShape(d, x, y)) || null
        : null;
      const obName = ob ? ob.name : null;
      if (ok === hoverOk && obName === hoverOb) return;
      hoverOk = ok;
      hoverOb = obName;
      redraw();
      report();
    });
    canvas.addEventListener("pointerleave", () => {
      hoverOk = hoverOb = null;
      redraw();
      report();
    });
    canvas.addEventListener("click", () => {
      if (o.onClick && (hoverOb || hoverOk)) o.onClick(hoverOk, hoverOb);
    });

    document.addEventListener("kv:focus", (e) => {
      const it = e.detail;
      if (!it) return;
      focusOk = it.okres || null;
      const ob = it.kind === "obec" ? OBC_BY[it.label] : null;
      pin = ob ? { name: ob.name, c: ob.c, t0: performance.now() } : null;
      redraw();
      report();
    });
    document.addEventListener("kv:choose", () => {
      chosen = { focusOk, pin };
    });
    document.addEventListener("kv:blur", () => {
      focusOk = chosen ? chosen.focusOk : null;
      pin = chosen ? chosen.pin : null;
      redraw();
      report();
    });

    readColors();
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      () => {
        readColors();
        redraw();
      },
    );
    new MutationObserver(() => {
      readColors();
      redraw();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    new ResizeObserver(layout).observe(canvas);
    if (document.fonts)
      document.fonts.ready.then(() => draw(performance.now()));
    requestAnimationFrame(loop);

    return {
      hover(ok) {
        hoverOk = ok;
        hoverOb = null;
        redraw();
        report();
      },
      setMode(m) {
        o.mode = m;
        dith = null;
        draw(performance.now());
      },
      seatPx: (ok) => (SEAT[ok] ? px(...SEAT[ok].c) : null),
      obecPx: (name) => (OBC_BY[name] ? px(...OBC_BY[name].c) : null),
      obec: (name) => OBC_BY[name] || null,
      size: () => [W, H],
    };
  };
})();
