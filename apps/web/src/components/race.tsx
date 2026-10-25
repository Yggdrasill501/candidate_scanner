import Link from "next/link";
import type { Race, RaceRef } from "@/lib/data";
import { formatNumber, t, type Lang } from "@/lib/i18n";
import type { RaceResults } from "@/lib/results";

/** "Primátor · Nitra", "Poslanci obce · Nitra, volebný obvod 3", "Poslanci NSK · volebný obvod 2". */
export function raceTitle(
  lang: Lang,
  r: RaceRef,
): { name: string; where: string } {
  const d = t(lang).race;
  const district = r.district ? d.district(r.district) : "";
  if (r.kind === "regional_governor")
    return { name: d.kind.regional_governor, where: d.wholeRegion };
  if (r.kind === "regional_council")
    return { name: d.kind.regional_council, where: district };
  return {
    name: `${d.kind[r.kind]} · ${r.municipality ?? ""}`,
    where: [
      r.kind === "municipal_council" ? district : "",
      r.okres ? `${t(lang).ballot.district} ${r.okres}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

const pct = (lang: Lang, present: number, total: number) =>
  `${((present / total) * 100).toFixed(0)} %`.replace(
    ".",
    lang === "en" ? "." : ",",
  );

/**
 * The comparison table: every candidate in ballot order with identical rows. Attendance is shown
 * as a column only when someone in the race sat on a council whose votes we collect; everyone
 * else in that race gets "—" so the rows stay identical. 2026 vote totals come from ŠÚ SR when
 * available; the column is shown for the whole race so rows stay identical.
 */
export function RaceTable({
  lang,
  race,
  results,
}: {
  lang: Lang;
  race: Race;
  results?: RaceResults | null;
}) {
  const d = t(lang).race;
  const withAtt = race.candidatesList.some((c) => c.attendance);
  const withResults =
    !!results &&
    (results.status === "live" || results.status === "cached") &&
    Object.keys(results.byBallot).length > 0;
  if (!race.candidatesList.length) return <p className="empty">{d.none}</p>;
  const mods = [withAtt ? "att" : "", withResults ? "results" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`list${mods ? ` ${mods}` : ""}`} role="table">
      <div className="r th" role="row">
        <span role="columnheader">{d.cols.no}</span>
        <span role="columnheader">{d.cols.name}</span>
        <span role="columnheader">{d.cols.age}</span>
        <span role="columnheader">{d.cols.occupation}</span>
        <span role="columnheader">{d.cols.party}</span>
        {withResults && <span role="columnheader">{d.cols.result}</span>}
        <span role="columnheader">{d.cols.history}</span>
        <span role="columnheader">{d.cols.firms}</span>
        {withAtt && <span role="columnheader">{d.cols.attendance}</span>}
        <span />
      </div>
      {race.candidatesList.map((c) => {
        const result =
          c.ballotNumber != null
            ? results?.byBallot[c.ballotNumber]
            : undefined;
        const cells = (
          <>
            <span className="no" role="cell">
              {c.ballotNumber ?? "—"}
            </span>
            <span className="nm" role="cell">
              {c.titlesBefore && <span className="t">{c.titlesBefore}</span>}
              <b>
                {c.givenName} {c.familyName}
              </b>
              {c.titlesAfter && <span className="t">, {c.titlesAfter}</span>}
              {c.residence && <small>{c.residence}</small>}
            </span>
            <span className="n age" role="cell">
              {c.age ?? "—"}
            </span>
            <span className="c occ" role="cell">
              {c.occupation ?? "—"}
            </span>
            <span className="c party" role="cell">
              {c.party ?? "—"}
            </span>
            {withResults && (
              <span
                className={`n res${result?.elected ? "yes" : ""}`}
                role="cell"
                data-label={d.cols.result}
              >
                {result?.votes != null ? (
                  <>
                    {formatNumber(lang, result.votes)}
                    {result.voteShare != null && (
                      <small>
                        {" "}
                        (
                        {result.voteShare
                          .toFixed(2)
                          .replace(".", lang === "en" ? "." : ",")}
                        %)
                      </small>
                    )}
                    {result.elected === true && (
                      <small className="elected"> · {d.elected}</small>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </span>
            )}
            <span
              className={`n hist${c.pastCandidacies ? "" : "zero"}`}
              role="cell"
              data-label={d.cols.history}
            >
              {c.pastCandidacies} / {c.pastElected}
            </span>
            <span
              className={`n firms${c.businessRoles ? "" : "zero"}`}
              role="cell"
            >
              {formatNumber(lang, c.businessRoles)}
            </span>
            {withAtt && (
              <span
                className={`n att${c.attendance ? "" : "zero"}`}
                role="cell"
                data-label={d.cols.attendance}
              >
                {c.attendance
                  ? pct(lang, c.attendance.present, c.attendance.total)
                  : d.notMember}
              </span>
            )}
            <span className="go" aria-hidden="true">
              →
            </span>
          </>
        );
        return (
          <div className="row" key={c.candidacyId} role="rowgroup">
            {c.personSlug ? (
              <Link
                className="r"
                role="row"
                href={`/${lang}/kandidat/${c.personSlug}`}
              >
                {cells}
              </Link>
            ) : (
              <div className="r" role="row">
                {cells}
              </div>
            )}
            {c.summary && (
              <details className="sum">
                <summary>
                  <span
                    className="mono"
                    style={{ color: "var(--dim)", fontSize: 11 }}
                  >
                    {d.cols.summary} ·{" "}
                  </span>
                  {c.summary}
                </summary>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A small card linking to a race, used on ballots, profiles and the candidate directory. */
export function RaceCard({
  lang,
  race,
  /** When set, the district (or place) is the heading — avoids repeating the race kind. */
  heading = "race",
}: {
  lang: Lang;
  race: RaceRef;
  heading?: "race" | "place";
}) {
  const d = t(lang);
  const title = raceTitle(lang, race);
  const empty = race.candidates === 0;
  const main = heading === "place" && title.where ? title.where : title.name;
  const sub = heading === "place" ? null : title.where || null;
  const body = (
    <>
      {heading === "race" && (
        <span className="eyebrow">{d.race.kindShort[race.kind]}</span>
      )}
      <h2>{main}</h2>
      {sub && <span className="where">{sub}</span>}
      <span className="facts">
        <span>
          <b>{race.candidates}</b>{" "}
          {d.race.candidates(race.candidates).replace(/^\d+\s*/, "")}
        </span>
        {!empty && <span className="go">{d.ballot.open} →</span>}
      </span>
      {empty && <span className="muted">{d.race.none}</span>}
    </>
  );
  return empty ? (
    <div className="ballot-card glass none">{body}</div>
  ) : (
    <Link className="ballot-card glass" href={`/${lang}/volby/${race.slug}`}>
      {body}
    </Link>
  );
}
