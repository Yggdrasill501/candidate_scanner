import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { RaceTable, raceTitle } from "@/components/race";
import { Shell } from "@/components/shell";
import { getRace, getSiteStats } from "@/lib/data";
import { formatDate, t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getRaceResults, resultsPortalUrl } from "@/lib/results";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/volby/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLang();
  const race = await getRace(slug, lang);
  if (!race) return {};
  const title = raceTitle(lang, race);
  return { title: [title.name, title.where].filter(Boolean).join(", ") };
}

async function RacePage({
  lang,
  params,
}: {
  lang: Lang;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [race, stats] = await Promise.all([
    getRace(slug, lang),
    getSiteStats(),
  ]);
  if (!race) notFound();
  const results = await getRaceResults({
    kind: race.kind,
    electionCode: race.electionCode,
    municipalityCode: race.municipalityCode,
    district: race.district,
  });
  const d = t(lang);
  const title = raceTitle(lang, race);
  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}/kandidati`}>{d.nav.candidates}</Link>
        {race.municipalitySlug && (
          <span>
            <Link href={`/${lang}/obec/${race.municipalitySlug}`}>
              {race.municipality}
            </Link>
          </span>
        )}
        <span>{d.race.kindShort[race.kind]}</span>
      </p>
      <div className="head rise d2">
        <div>
          <h1 className="title sm">{title.name}</h1>
          <p className="lede">
            {[title.where, d.race.data(formatDate(stats.dataDate))]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="stats">
          <div>
            <b>{race.candidates}</b>
            <span>{d.list.stats.candidates}</span>
          </div>
          {race.seats && (
            <div>
              <b>{race.seats}</b>
              <span>{d.race.seats(race.seats).replace(/^\d+\s*/, "")}</span>
            </div>
          )}
        </div>
      </div>
      {results && (
        <p className="results-status rise d2" role="status">
          {results.status === "counting" && d.race.counting}
          {results.status === "unavailable" && d.race.resultsUnavailable}
          {(results.status === "live" || results.status === "cached") &&
            results.updatedAt &&
            d.race.resultsUpdated(results.updatedAt)}
          {results.fromCache && ` · ${d.race.resultsCached}`}
          {" · "}
          <a
            href={resultsPortalUrl(race.kind)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {d.race.resultsSource}
          </a>
        </p>
      )}
      <section className="race glass rise d3" style={{ marginTop: 28 }}>
        <RaceTable lang={lang} race={race} results={results} />
      </section>
      <p className="legend">{d.race.ballotOrder}</p>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/volby/[slug]">) {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <Suspense fallback={<PageFallback />}>
        <RacePage lang={lang} params={params} />
      </Suspense>
    </Shell>
  );
}
