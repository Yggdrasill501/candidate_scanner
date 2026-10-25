import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { SOURCES_PAGE } from "@/lib/content";
import { getSources, type SourceInfo } from "@/lib/data";
import { formatDate, formatNumber, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SOURCES_PAGE[await getLang()].title };
}

function Card({ lang, s }: { lang: Lang; s: SourceInfo }) {
  const d = SOURCES_PAGE[lang];
  return (
    <article className="src-card glass">
      <span className={`status ${s.kind}`}>
        {d.kind[s.kind as "primary" | "secondary"] ?? s.kind}
      </span>
      <div>
        <h3>{s.name}</h3>
        <a
          className="url"
          href={s.baseUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {s.baseUrl.replace(/^https?:\/\//, "")} ↗
        </a>
      </div>
      <dl>
        <dt>{d.last}</dt>
        <dd className="mono">{formatDate(s.lastRetrieved) || "—"}</dd>
        <dt>{d.snapshots}</dt>
        <dd className="mono">{formatNumber(lang, s.snapshots)}</dd>
        <dt>{d.facts}</dt>
        <dd className="mono">{formatNumber(lang, s.facts)}</dd>
      </dl>
    </article>
  );
}

export default async function Page() {
  const lang = await getLang();
  const d = SOURCES_PAGE[lang];
  const sources = await getSources();
  const groups = [
    [d.primary, sources.filter((s) => s.kind === "primary")],
    [d.secondary, sources.filter((s) => s.kind !== "primary")],
  ] as const;
  return (
    <Shell lang={lang}>
      <p className="crumbs rise d1">
        <Link href={`/${lang}`}>Koho volím</Link>
        <span>{d.title}</span>
      </p>
      <h1 className="title rise d2">{d.title}</h1>
      <p className="lede rise d2">{d.lede}</p>
      {groups.map(([title, list]) => (
        <section key={title} className="block">
          <h2>{title}</h2>
          <div className="src-cards">
            {list.map((s) => (
              <Card key={s.code} lang={lang} s={s} />
            ))}
          </div>
        </section>
      ))}
    </Shell>
  );
}
