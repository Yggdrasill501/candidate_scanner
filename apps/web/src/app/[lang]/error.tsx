"use client";

import { useParams } from "next/navigation";
import { isLang, t } from "@/lib/i18n";

// The data sources, so a visitor can still reach the facts while the database is down.
const SOURCES = [
  [
    "MV SR – zoznamy zaregistrovaných kandidátov",
    "https://www.minv.sk/?samosprava26-info10",
  ],
  ["Register právnických osôb (ŠÚ SR)", "https://rpo.statistics.sk/"],
  ["Register partnerov verejného sektora", "https://rpvs.gov.sk/"],
  [
    "Register mimovládnych neziskových organizácií",
    "https://ives.minv.sk/rmno",
  ],
] as const;

/** No partial or stale-mixed pages: when a read fails, the whole page says so. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const lang = params.lang && isLang(params.lang) ? params.lang : "sk";
  const d = t(lang).error;
  return (
    <div className="page">
      <h1 className="title" style={{ marginTop: 80 }}>
        {d.title}
      </h1>
      <p className="lede">{d.lede}</p>
      <ul className="prose" style={{ marginTop: 18 }}>
        {SOURCES.map(([name, url]) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--moon)" }}
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="pillbtn"
        onClick={reset}
        style={{ marginTop: 18 }}
      >
        {d.retry}
      </button>
    </div>
  );
}
