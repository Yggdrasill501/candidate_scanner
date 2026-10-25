import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { RaceCard } from "@/components/race";
import { ResultsStandings } from "@/components/results-standings";
import { Shell } from "@/components/shell";
import { getRace, getRegionalRaces } from "@/lib/data";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getRaceResults, resultsPortalUrl } from "@/lib/results";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang()).resultsPage.title };
}

async function ResultsBody({ lang }: { lang: Lang }) {
  const d = t(lang);
  const regional = await getRegionalRaces();
  const governorRef = regional.find((r) => r.kind === "regional_governor");
  const councils = regional
    .filter((r) => r.kind === "regional_council")
    .slice()
    .sort((a, b) => (a.district ?? 0) - (b.district ?? 0));

  const governor = governorRef ? await getRace(governorRef.slug, lang) : null;
  const results = governor
    ? await getRaceResults({
        kind: governor.kind,
        electionCode: governor.electionCode,
        municipalityCode: governor.municipalityCode,
        district: governor.district,
      })
    : null;
  const showStandings =
    results &&
    (results.status === "live" || results.status === "cached") &&
    Object.keys(results.byBallot).length > 0;

  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}`}>Koho volím</Link>
        <span>{d.nav.results}</span>
      </p>
      <div className="head rise d2">
        <div>
          <h1 className="title">{d.resultsPage.title}</h1>
          <p className="lede">{d.resultsPage.lede}</p>
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
            href={resultsPortalUrl("regional_governor")}
            target="_blank"
            rel="noopener noreferrer"
          >
            {d.race.resultsSource}
          </a>
        </p>
      )}

      <section className="results-section rise d3">
        <header className="results-section-head">
          <div>
            <p className="eyebrow">{d.resultsPage.vuc}</p>
            <h2>{d.resultsPage.governor}</h2>
          </div>
          {governor && (
            <Link href={`/${lang}/volby/${governor.slug}`}>
              {d.resultsPage.openRace} →
            </Link>
          )}
        </header>
        {governor && showStandings ? (
          <div className="standings-panel glass">
            <ResultsStandings lang={lang} race={governor} results={results} />
          </div>
        ) : (
          <p className="empty">{d.race.counting}</p>
        )}
        <p className="legend">{d.race.ballotOrder}</p>
      </section>

      <section className="results-section rise d3">
        <header className="results-section-head">
          <div>
            <h2>{d.resultsPage.council}</h2>
            <p className="lede tight">{d.resultsPage.councilHint}</p>
          </div>
        </header>
        <div className="regional-cards">
          {councils.map((r) => (
            <RaceCard key={r.slug} lang={lang} race={r} heading="place" />
          ))}
        </div>
      </section>

      <section className="results-section rise d3">
        <header className="results-section-head">
          <div>
            <h2>{d.resultsPage.municipal}</h2>
            <p className="lede tight">{d.resultsPage.municipalHint}</p>
          </div>
        </header>
        <p>
          <Link className="pillbtn glass" href={`/${lang}`}>
            {d.resultsPage.openMunicipal} →
          </Link>{" "}
          <Link className="pillbtn glass" href={`/${lang}/kandidati`}>
            {d.nav.candidates} →
          </Link>
        </p>
      </section>
    </>
  );
}

export default async function Page() {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <Suspense fallback={<PageFallback />}>
        <ResultsBody lang={lang} />
      </Suspense>
    </Shell>
  );
}
