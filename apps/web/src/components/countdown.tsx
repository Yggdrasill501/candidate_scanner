"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

// Polling stations are open 7:00–20:00 CEST on 24 October 2026.
const OPENS = Date.parse("2026-10-24T07:00:00+02:00");
const CLOSES = Date.parse("2026-10-24T20:00:00+02:00");

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ lang }: { lang: Lang }) {
  const d = t(lang).home;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  let label = d.countdownBefore;
  let value = "…";
  let closed = false;
  if (now !== null) {
    if (now >= CLOSES) {
      label = d.closed;
      value = "";
      closed = true;
    } else {
      const open = now >= OPENS;
      label = open ? d.countdownOpen : d.countdownBefore;
      const p = parts((open ? CLOSES : OPENS) - now);
      value = `${p.d ? `${p.d} d ` : ""}${p.h} h ${pad(p.m)} min ${pad(p.s)} s`;
    }
  }

  const body = (
    <>
      <span className="dot" aria-hidden="true" />
      <span>{label}</span>
      {value && <b>{value}</b>}
    </>
  );

  if (closed) {
    return (
      <Link
        className="pill glass rise d1"
        href={`/${lang}/vysledky`}
        aria-label={`${label} · ${t(lang).nav.results}`}
      >
        {body}
      </Link>
    );
  }

  return <p className="pill glass rise d1">{body}</p>;
}
