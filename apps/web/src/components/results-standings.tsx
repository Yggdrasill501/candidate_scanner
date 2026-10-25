import Link from "next/link";
import type { Race } from "@/lib/data";
import { formatNumber, t, type Lang } from "@/lib/i18n";
import type { RaceResults } from "@/lib/results";

const SINGLE_SEAT = new Set(["mayor", "regional_governor"]);

/** Ballot of the elected candidate, or absolute majority in a single-seat race. */
function winnerBallot(race: Race, results: RaceResults): number | null {
  const entries = Object.values(results.byBallot);
  const flagged = entries.find((r) => r.elected === true);
  if (flagged) return flagged.ballotNumber;
  if (!SINGLE_SEAT.has(race.kind)) return null;
  let best: (typeof entries)[number] | null = null;
  for (const r of entries) {
    if (r.votes == null) continue;
    if (!best || (best.votes ?? 0) < r.votes) best = r;
  }
  if (best && best.voteShare != null && best.voteShare >= 50) {
    return best.ballotNumber;
  }
  return null;
}

/**
 * Results-focused table for the Výsledky page: name, party, votes, share.
 * Keeps official ballot order; highlights the elected / absolute-majority winner.
 */
export function ResultsStandings({
  lang,
  race,
  results,
}: {
  lang: Lang;
  race: Race;
  results: RaceResults;
}) {
  const d = t(lang).race;
  const winner = winnerBallot(race, results);
  const maxVotes = Math.max(
    0,
    ...Object.values(results.byBallot).map((r) => r.votes ?? 0),
  );

  return (
    <div className="standings" role="table">
      <div className="s-row th" role="row">
        <span role="columnheader">{d.cols.no}</span>
        <span role="columnheader">{d.cols.name}</span>
        <span role="columnheader">{d.cols.party}</span>
        <span role="columnheader">{d.cols.result}</span>
      </div>
      {race.candidatesList.map((c) => {
        const result =
          c.ballotNumber != null ? results.byBallot[c.ballotNumber] : undefined;
        const isWinner = c.ballotNumber != null && c.ballotNumber === winner;
        const bar =
          maxVotes > 0 && result?.votes != null
            ? (result.votes / maxVotes) * 100
            : 0;
        const row = (
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
              {isWinner && <span className="win-tag">{d.elected}</span>}
            </span>
            <span className="party" role="cell">
              {c.party ?? "—"}
            </span>
            <span className="votes" role="cell">
              {result?.votes != null ? (
                <>
                  <span className="vote-line">
                    <b>{formatNumber(lang, result.votes)}</b>
                    {result.voteShare != null && (
                      <small>
                        {result.voteShare
                          .toFixed(2)
                          .replace(".", lang === "en" ? "." : ",")}
                        %
                      </small>
                    )}
                  </span>
                  <span
                    className="vote-bar"
                    style={{ width: `${bar}%` }}
                    aria-hidden="true"
                  />
                </>
              ) : (
                "—"
              )}
            </span>
          </>
        );
        const cls = `s-row${isWinner ? " winner" : ""}`;
        return c.personSlug ? (
          <Link
            key={c.candidacyId}
            className={cls}
            role="row"
            href={`/${lang}/kandidat/${c.personSlug}`}
          >
            {row}
          </Link>
        ) : (
          <div key={c.candidacyId} className={cls} role="row">
            {row}
          </div>
        );
      })}
    </div>
  );
}
