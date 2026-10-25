"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@repo/contract";
import { formatNumber, t, type Lang } from "@/lib/i18n";
import { slugify } from "@/lib/names";
import { SearchBox } from "../search-box";
import { createMap, loadGeo, type MapApi } from "./engine";

interface Muni {
  name: string;
  slug: string;
  district: string;
  candidates: number;
}

interface Tip {
  kind: string;
  name: string;
  rows: [string, string][];
  x: number;
  y: number;
}

const key = (okres: string, name: string) => `${okres}|${slugify(name)}`;

const classes = (...names: (string | false | null)[]) =>
  names.filter(Boolean).join(" ");

/**
 * The homepage's interactive part: the line search, district chips and the Hranice map.
 * Hovering the map shows a tooltip; clicking a municipality opens its ballot, a district its list of races.
 */
export function HomeMap({
  lang,
  municipalities,
  samples,
  children,
}: {
  lang: Lang;
  municipalities: Muni[];
  samples: string[];
  /** The static copy above the search: countdown, heading, lede. */
  children: React.ReactNode;
}) {
  const d = t(lang).home;
  const canvas = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const map = useRef<MapApi | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hoverOk, setHoverOk] = useState<string | null>(null);

  const byKey = useRef(
    new Map(municipalities.map((m) => [key(m.district, m.name), m])),
  );
  const okresy = Object.entries(
    municipalities.reduce<Record<string, number>>((acc, m) => {
      acc[m.district] = (acc[m.district] ?? 0) + 1;
      return acc;
    }, {}),
  );

  useEffect(() => {
    let api: MapApi | null = null;
    let cancelled = false;
    loadGeo().then((geo) => {
      if (cancelled || !canvas.current) return;
      const km2 = new Map(geo.okresy.map((o) => [o.name, o.km2]));
      api = createMap(canvas.current, geo, {
        alignX: 0.55,
        // Canvas fonts cannot use CSS variables; resolve next/font's family names once.
        font: `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono")}, ui-monospace, monospace`,
        labelFont: getComputedStyle(document.body).fontFamily,
        onClick(ok, ob) {
          const m = ob && ok ? byKey.current.get(key(ok, ob)) : undefined;
          if (m) router.push(`/${lang}/obec/${m.slug}`);
          else if (ok) router.push(`/${lang}/kandidati#${slugify(ok)}`);
        },
        onHover(ok, ob) {
          setHoverOk(ok);
          if (!api || (!ok && !ob)) return setTip(null);
          let p: [number, number] | null;
          let next: Omit<Tip, "x" | "y">;
          if (ob) {
            const o = api.obec(ob);
            const m = ok ? byKey.current.get(key(ok, ob)) : undefined;
            p = api.obecPx(ob);
            next = {
              kind: d.tipMunicipality,
              name: ob,
              rows: [
                [d.tipDistrict, o?.okres ?? ""],
                [
                  d.tipArea,
                  `${formatNumber(lang, Number(o?.km2.toFixed(1) ?? 0))} km²`,
                ],
                [d.tipCandidates, m ? formatNumber(lang, m.candidates) : "—"],
                [d.tipClick, d.tipOpenBallot],
              ],
            };
          } else {
            p = api.seatPx(ok!);
            next = {
              kind: d.tipDistrict,
              name: ok!,
              rows: [
                [
                  d.tipCount,
                  String(
                    municipalities.filter((m) => m.district === ok).length,
                  ),
                ],
                [
                  d.tipArea,
                  `${formatNumber(lang, Math.round(km2.get(ok!) ?? 0))} km²`,
                ],
                [d.tipClick, d.tipOpenList],
              ],
            };
          }
          if (!p) return setTip(null);
          const [W, H] = api.size();
          const tw = tipRef.current?.offsetWidth ?? 230;
          const th = tipRef.current?.offsetHeight ?? 150;
          setTip({
            ...next,
            x: Math.max(8, Math.min(W - tw - 8, p[0] + 28)),
            y: Math.max(8, Math.min(H - th - 8, p[1] - th - 18)),
          });
        },
      });
      map.current = api;
    });
    return () => {
      cancelled = true;
      api?.destroy();
      map.current = null;
    };
  }, [lang, municipalities, router, d]);

  function onFocusHit(hit: SearchHit | null) {
    const api = map.current;
    if (!api) return;
    if (hit?.kind === "municipality") {
      api.pin(hit.label);
      api.focus(hit.meta);
    } else if (hit?.kind === "okres") {
      api.pin(null);
      api.focus(
        okresy.find(([name]) => slugify(name) === hit.slug)?.[0] ?? null,
      );
    } else {
      api.pin(null);
      api.focus(null);
    }
  }

  return (
    <main className="stage">
      <section className="copy">
        {children}
        <div className="search-slot rise d4">
          <SearchBox
            lang={lang}
            variant="home"
            samples={samples}
            onFocusHit={onFocusHit}
          />
        </div>
        <div className="chips rise d5" aria-label={d.tipDistrict}>
          {okresy.map(([name, n]) => (
            <Link
              key={name}
              className={classes("chip", "glass", hoverOk === name && "on")}
              href={`/${lang}/kandidati#${slugify(name)}`}
              onMouseEnter={() => map.current?.hover(name)}
              onMouseLeave={() => map.current?.hover(null)}
            >
              {name} <small>{n}</small>
            </Link>
          ))}
        </div>
      </section>
      <MapSlot
        canvas={canvas}
        tipRef={tipRef}
        tip={tip}
        lang={lang}
        count={municipalities.length}
      />
    </main>
  );
}

function MapSlot({
  canvas,
  tipRef,
  tip,
  lang,
  count,
}: {
  canvas: React.RefObject<HTMLCanvasElement | null>;
  tipRef: React.RefObject<HTMLDivElement | null>;
  tip: Tip | null;
  lang: Lang;
  count: number;
}) {
  const d = t(lang).home;
  return (
    <div className="mapbox rise d3">
      <canvas ref={canvas} role="img" aria-label={d.mapLabel(count)} />
      <div
        ref={tipRef}
        className={classes("tip", "glass", tip && "on")}
        style={tip ? { left: tip.x, top: tip.y } : undefined}
        aria-live="polite"
      >
        <small>{tip?.kind}</small>
        <b>{tip?.name}</b>
        <dl>
          {tip?.rows.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <span className="legend-note">{d.mapNote}</span>
    </div>
  );
}
