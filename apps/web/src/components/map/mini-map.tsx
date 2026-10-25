"use client";

import { useEffect, useRef } from "react";
import { createMap, loadGeo } from "./engine";

/** A small static Hranice map with one municipality pinned (the candidate's residence). */
export function MiniMap({ pin, label }: { pin: string | null; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let api: ReturnType<typeof createMap> | null = null;
    let cancelled = false;
    loadGeo().then((geo) => {
      if (cancelled || !canvas.current) return;
      api = createMap(canvas.current, geo, {
        pad: 0.04,
        font: `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono")}, ui-monospace, monospace`,
        labelFont: getComputedStyle(document.body).fontFamily,
      });
      api.pin(pin);
    });
    return () => {
      cancelled = true;
      api?.destroy();
    };
  }, [pin]);
  return <canvas ref={canvas} role="img" aria-label={label} />;
}
