import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { RaceCard } from "@/components/race";
import { ResultsStandings } from "@/components/results-standings";
import { Shell } from "@/components/shell";
import { getBallot, getRace, type Race, type RaceRef } from "@/lib/data";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { slugify } from "@/lib/names";
import {
  getRaceResults,
  resultsPortalUrl,
  type RaceResults,
} from "@/lib/results";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/obec/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLang();
  const ballot = await getBallot(slug);
  return ballot
    ? { title: t(lang).ballot.title(ballot.municipality.name) }
    : {};
}

function showStandings(results: RaceResults | null | undefined): boolean {
  return (
    !!results &&
    (results.status === "live" || results.status === "cached") &&
    Object.keys(results.byBallot).length > 0
  );
}

async function loadRaceBundle(
  ref: RaceRef | null | undefined,
  lang: Lang,
): Promise<{ race: Race; results: RaceResults } | null> {
  if (!ref) return null;
  const race = await getRace(ref.slug, lang);
  if (!race) return null;
  const results = await getRaceResults({
    kind: race.kind,
    electionCode: race.electionCode,
    municipalityCode: race.municipalityCode,
    district: race.district,
  });
  if (!results) return null;
  return { race, results };
}

function DistrictPicker({
  lang,
  base,
  councils,
  picked,
}: {
  lang: Lang;
  base: string;
  councils: RaceRef[];
  picked: number | null;
}) {
  const d = t(lang).ballot;
  return (
    <>
      <div className="picker rise d3" role="group" aria-label={d.pickDistrict}>
        <span className="label">{d.pickDistrict}</span>
        {councils.map((c) => (
          <Link
            key={c.slug}
            className="pillbtn"
            href={`${base}?obvod=${c.district}`}
            aria-current={picked === c.district ? "true" : undefined}
          >
            {d.districtLabel(c.district ?? 0)}
          </Link>
        ))}
        <Link
          className="pillbtn"
          href={base}
          aria-current={!picked ? "true" : undefined}
        >
          {d.dontKnow}
        </Link>
      </div>
      <p className="note">{d.noAddressMap}</p>
    </>
  );
}

function ResultsStatus({
  lang,
  results,
  kind,
}: {
  lang: Lang;
  results: RaceResults;
  kind: Race["kind"];
}) {
  const d = t(lang).race;
  return (
    <p className="results-status rise d2" role="status">
      {results.status === "counting" && d.counting}
      {results.status === "unavailable" && d.resultsUnavailable}
      {(results.status === "live" || results.status === "cached") &&
        results.updatedAt &&
        d.resultsUpdated(results.updatedAt)}
      {results.fromCache && ` · ${d.resultsCached}`}
      {" · "}
      <a
        href={resultsPortalUrl(kind)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {d.resultsSource}
      </a>
    </p>
  );
}

/**
 * Municipality page: ballot picker by default; when local ŠÚ results are in,
 * standings for starosta (+ selected council) first, NSK only as a link out.
 */
async function BallotPage({
  lang,
  params,
  searchParams,
}: {
  lang: Lang;
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const ballot = await getBallot(slug);
  if (!ballot) notFound();
  const d = t(lang);
  const m = ballot.municipality;
  const picked = Number(query.obvod) || null;
  const multiCouncil = ballot.councils.length > 1;
  const councils =
    picked && ballot.councils.some((c) => c.district === picked)
      ? ballot.councils.filter((c) => c.district === picked)
      : ballot.councils;
  const base = `/${lang}/obec/${m.slug}`;

  // Standings only for a single council target: the only race, or a picked obvod.
  const councilTarget =
    !multiCouncil && ballot.councils[0]
      ? ballot.councils[0]
      : picked
        ? (ballot.councils.find((c) => c.district === picked) ?? null)
        : null;

  const [mayorBundle, councilBundle] = await Promise.all([
    loadRaceBundle(ballot.mayor, lang),
    loadRaceBundle(councilTarget, lang),
  ]);

  const mayorReady = showStandings(mayorBundle?.results);
  const councilReady = showStandings(councilBundle?.results);
  const hasLocalResults = mayorReady || councilReady;
  const statusSource = mayorBundle ?? councilBundle;

  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}/kandidati#${slugify(m.district)}`}>
          {d.ballot.district} {m.district}
        </Link>
        <span>{m.name}</span>
        {!hasLocalResults && (
          <span>
            <Link href={`/${lang}/vysledky`}>{d.nav.results}</Link>
          </span>
        )}
      </p>
      <h1 className="title rise d2">{m.name}</h1>
      <p className="lede rise d2">
        {hasLocalResults ? d.ballot.resultsLede : d.home.ballotTitle}
      </p>

      {hasLocalResults && statusSource && (
        <ResultsStatus
          lang={lang}
          results={statusSource.results}
          kind={statusSource.race.kind}
        />
      )}

      {hasLocalResults ? (
        <>
          {ballot.mayor && (
            <section className="results-section rise d3">
              <header className="results-section-head">
                <div>
                  <h2>{d.race.kindShort.mayor}</h2>
                </div>
                <Link href={`/${lang}/volby/${ballot.mayor.slug}`}>
                  {d.resultsPage.openRace} →
                </Link>
              </header>
              {mayorBundle && mayorReady ? (
                <div className="standings-panel glass">
                  <ResultsStandings
                    lang={lang}
                    race={mayorBundle.race}
                    results={mayorBundle.results}
                  />
                </div>
              ) : (
                <p className="empty">{d.race.counting}</p>
              )}
              <p className="legend">{d.race.ballotOrder}</p>
            </section>
          )}

          {ballot.councils.length > 0 && (
            <section className="results-section rise d3">
              <header className="results-section-head">
                <div>
                  <h2>{d.race.kindShort.municipal_council}</h2>
                  {multiCouncil && !picked && (
                    <p className="lede tight">{d.ballot.pickObvodForResults}</p>
                  )}
                </div>
                {councilTarget && (
                  <Link href={`/${lang}/volby/${councilTarget.slug}`}>
                    {d.resultsPage.openRace} →
                  </Link>
                )}
              </header>
              {multiCouncil && (
                <DistrictPicker
                  lang={lang}
                  base={base}
                  councils={ballot.councils}
                  picked={picked}
                />
              )}
              {councilBundle && councilReady ? (
                <>
                  <div className="standings-panel glass">
                    <ResultsStandings
                      lang={lang}
                      race={councilBundle.race}
                      results={councilBundle.results}
                    />
                  </div>
                  <p className="legend">{d.race.ballotOrder}</p>
                </>
              ) : multiCouncil && !picked ? (
                <div className="ballot-grid">
                  {ballot.councils.map((c) => (
                    <RaceCard key={c.slug} lang={lang} race={c} />
                  ))}
                </div>
              ) : (
                <p className="empty">{d.race.counting}</p>
              )}
            </section>
          )}

          <section className="results-section rise d3">
            <header className="results-section-head">
              <div>
                <h2>{d.ballot.nskResults}</h2>
              </div>
              <Link href={`/${lang}/vysledky`}>
                {d.ballot.toRegionalResults} →
              </Link>
            </header>
          </section>

          <section className="results-section rise d3">
            <header className="results-section-head">
              <div>
                <h2>{d.ballot.ballotBrowse}</h2>
              </div>
            </header>
            <div className="ballot-grid">
              {ballot.governor && (
                <RaceCard lang={lang} race={ballot.governor} />
              )}
              {ballot.regional.map((r) => (
                <RaceCard key={r.slug} lang={lang} race={r} />
              ))}
            </div>
            {ballot.regional.length > 1 && (
              <p className="note warn">{d.ballot.regionalSplit}</p>
            )}
          </section>
        </>
      ) : (
        <>
          {multiCouncil && (
            <DistrictPicker
              lang={lang}
              base={base}
              councils={ballot.councils}
              picked={picked}
            />
          )}
          <div className="ballot-grid rise d3">
            {ballot.mayor && <RaceCard lang={lang} race={ballot.mayor} />}
            {councils.map((c) => (
              <RaceCard key={c.slug} lang={lang} race={c} />
            ))}
            {ballot.governor && <RaceCard lang={lang} race={ballot.governor} />}
            {ballot.regional.map((r) => (
              <RaceCard key={r.slug} lang={lang} race={r} />
            ))}
          </div>
          {ballot.regional.length > 1 && (
            <p className="note warn">{d.ballot.regionalSplit}</p>
          )}
        </>
      )}
    </>
  );
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/obec/[slug]">) {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <Suspense fallback={<PageFallback />}>
        <BallotPage lang={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
