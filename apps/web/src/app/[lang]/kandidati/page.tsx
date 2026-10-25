import type { Metadata } from "next";
import Link from "next/link";
import { RaceCard } from "@/components/race";
import { Shell } from "@/components/shell";
import {
  getMunicipalities,
  getRegionalRaces,
  getSiteStats,
  type MunicipalityRow,
} from "@/lib/data";
import { formatNumber, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { slugify } from "@/lib/names";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang()).list.title };
}

/** Every race in the region: the regional ones first, then municipalities by okres. */
export default async function Page() {
  const lang = await getLang();
  const d = t(lang);
  const [stats, regional, municipalities] = await Promise.all([
    getSiteStats(),
    getRegionalRaces(),
    getMunicipalities(),
  ]);
  const okresy = new Map<string, MunicipalityRow[]>();
  for (const m of municipalities)
    okresy.set(m.district, [...(okresy.get(m.district) ?? []), m]);
  return (
    <Shell lang={lang}>
      <p className="crumbs rise d1">
        <Link href={`/${lang}`}>Koho volím</Link>
        <span>{d.list.title}</span>
      </p>
      <div className="head rise d2">
        <div>
          <h1 className="title">{d.list.title}</h1>
          <p className="lede">{d.list.lede}</p>
        </div>
        <div className="stats">
          <div>
            <b>{formatNumber(lang, stats.people)}</b>
            <span>{d.list.stats.candidates}</span>
          </div>
          <div>
            <b>{stats.municipalities}</b>
            <span>{d.list.stats.municipalities}</span>
          </div>
          <div>
            <b>{formatNumber(lang, stats.races)}</b>
            <span>{d.list.stats.races}</span>
          </div>
        </div>
      </div>
      <nav className="picker" aria-label={d.ballot.district}>
        {[...okresy.keys()].map((o) => (
          <a key={o} className="chip glass" href={`#${slugify(o)}`}>
            {o} <small>{okresy.get(o)!.length}</small>
          </a>
        ))}
      </nav>
      <section className="block">
        <h2>{d.list.regional}</h2>
        <div className="regional-cards">
          {regional.map((r) => (
            <RaceCard key={r.slug} lang={lang} race={r} />
          ))}
        </div>
      </section>
      <section className="okres-list">
        <h2 className="vh">{d.list.municipal}</h2>
        {[...okresy.entries()].map(([okres, list]) => (
          <div key={okres} id={slugify(okres)} style={{ scrollMarginTop: 100 }}>
            <h2>
              {d.ballot.district} {okres} <small>{list.length}</small>
            </h2>
            <div className="obce">
              {list.map((m) => (
                <Link key={m.slug} href={`/${lang}/obec/${m.slug}`}>
                  {m.name}
                  <small>{formatNumber(lang, m.candidates)}</small>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </Shell>
  );
}
