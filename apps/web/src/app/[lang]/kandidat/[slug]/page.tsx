import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { MiniMap } from "@/components/map/mini-map";
import { Match } from "@/components/match";
import { ProfileTabs } from "@/components/profile-tabs";
import { raceTitle } from "@/components/race";
import { Shell } from "@/components/shell";
import {
  getPerson,
  getSources,
  getVoteOverview,
  type Fact,
  type Person,
  type PersonVote,
  type SourceInfo,
  type SummarySentence,
  type VoteOverview,
} from "@/lib/data";
import {
  describe,
  researchLinks,
  SECTION_OF,
  SECTION_SOURCES,
  templateSummary,
  type Section,
} from "@/lib/facts";
import {
  clip,
  formatDate,
  formatNumber,
  t,
  yearOf,
  type Lang,
} from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/kandidat/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPerson(slug);
  return person ? { title: `${person.givenName} ${person.familyName}` } : {};
}

const SECTIONS = [
  "summary",
  "candidacies",
  "history",
  "business",
  "votes",
  "assets",
  "campaign",
  "media",
  "research",
  "sources",
] as const;

/** Footnote numbers in order of first use; each points at a fact or a 2026 candidacy. */
function footnotes(sentences: SummarySentence[]) {
  const order = new Map<string, number>();
  for (const s of sentences)
    for (const id of [
      ...s.candidacy_ids.map((c) => `c-${c}`),
      ...s.fact_ids.map((f) => `f-${f}`),
    ])
      if (!order.has(id)) order.set(id, order.size + 1);
  return order;
}

function SourceLink({
  lang,
  url,
  date,
}: {
  lang: Lang;
  url: string;
  date: string;
}) {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();
  return (
    <a
      className="src"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${t(lang).profile.retrieved} ${formatDate(date)}`}
    >
      {host} ↗
    </a>
  );
}

function FactCard({ lang, fact }: { lang: Lang; fact: Fact }) {
  const text = describe(lang, fact);
  return (
    <div className="fact" id={`f-${fact.id}`}>
      <div className="row">
        <span className="what">
          <b>{text.title}</b>
        </span>
        {text.when && <span className="when">{text.when}</span>}
        <SourceLink lang={lang} url={fact.sourceUrl} date={fact.retrievedAt} />
      </div>
      {text.detail && <p className="detail">{text.detail}</p>}
      <Match lang={lang} reason={fact.match} />
    </div>
  );
}

/** "Nenájdené v: …" or, when a source failed for this person, the outage with its date. */
function Empty({
  lang,
  person,
  section,
  sources,
}: {
  lang: Lang;
  person: Person;
  section: Section;
  sources: Map<string, SourceInfo>;
}) {
  const d = t(lang).profile;
  const codes = SECTION_SOURCES[section];
  const down = person.outcomes.filter(
    (o) => codes.includes(o.sourceCode) && o.status === "source_unavailable",
  );
  return (
    <>
      {down.map((o) => (
        <p key={o.sourceCode} className="empty down">
          {d.sourceDown(
            sources.get(o.sourceCode)?.name ?? o.sourceCode,
            formatDate(o.checkedAt),
          )}
        </p>
      ))}
      <p className="empty">
        <b>{d.notFoundIn}</b>{" "}
        {codes.map((c) => sources.get(c)?.name ?? c).join(" · ")}
      </p>
    </>
  );
}

function SummaryBlock({ lang, person }: { lang: Lang; person: Person }) {
  const d = t(lang).profile;
  const stored = person.summaries.find((s) => s.lang === lang);
  const sentences =
    stored?.sentences ??
    templateSummary(lang, person.candidacies, person.facts);
  const isAi = stored?.method === "ai";
  const order = footnotes(sentences);
  return (
    <div className="summary glass">
      <div className="head">
        <span className="eyebrow">{isAi ? d.aiLabel : d.templateLabel}</span>
      </div>
      <p className="text">
        {sentences.map((s, i) => {
          const refs = [
            ...s.candidacy_ids.map((c) => `c-${c}`),
            ...s.fact_ids.map((f) => `f-${f}`),
          ];
          return (
            <span key={i}>
              {s.text}
              {refs.length > 0 && (
                <sup>
                  {[...new Set(refs)].map((r) => (
                    <a key={r} href={`#${r}`}>
                      {order.get(r)}
                    </a>
                  ))}
                </sup>
              )}{" "}
            </span>
          );
        })}
      </p>
      {isAi && stored?.model && (
        <p className="note">
          {d.aiNote(stored.model, formatDate(stored.generatedAt))}
        </p>
      )}
    </div>
  );
}

function HistoryTable({ lang, facts }: { lang: Lang; facts: Fact[] }) {
  const d = t(lang);
  const c = d.profile.histCols;
  return (
    <div className="tablewrap">
      <table className="hist">
        <thead>
          <tr>
            <th>{c.year}</th>
            <th>{c.race}</th>
            <th>{c.party}</th>
            <th>{c.occupation}</th>
            <th>{c.result}</th>
            <th>{c.match}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...facts].reverse().map((f) => {
            const p = f.payload;
            const kind = String(p.race_kind) as keyof typeof d.race.kindShort;
            return (
              <tr key={f.id} id={`f-${f.id}`}>
                <td className="y">{yearOf(f.from)}</td>
                <td>
                  {d.race.kindShort[kind] ?? kind}
                  <small>
                    {String(p.municipality_name ?? "NSK")}
                    {p.district
                      ? ` · ${d.race.district(Number(p.district))}`
                      : ""}
                  </small>
                </td>
                <td>{p.party ? String(p.party) : "—"}</td>
                <td>{p.occupation ? String(p.occupation) : "—"}</td>
                <td className={`res ${p.elected ? "yes" : "no"}`}>
                  {p.elected ? d.profile.elected : d.profile.notElected}
                  {typeof p.votes === "number" && (
                    <small>
                      {d.profile.votes(formatNumber(lang, p.votes))}
                    </small>
                  )}
                </td>
                <td>
                  <Match lang={lang} reason={f.match} />
                </td>
                <td>
                  <SourceLink
                    lang={lang}
                    url={f.sourceUrl}
                    date={f.retrievedAt}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VoteRow({ lang, v }: { lang: Lang; v: PersonVote }) {
  const d = t(lang).profile;
  return (
    <div className="vote">
      <span className="desc">
        #{v.voteNumber} {clip(v.description)}
      </span>
      <span className="ch">{d.choice[v.choice]}</span>
      <span className="meta2">
        <span>{d.session(v.sessionNumber, formatDate(v.sessionDate))}</span>
        {v.material && <span>Mat. č. {v.material}</span>}
        <span title={d.counts}>
          ({v.counts.map((n) => n ?? "?").join(" : ")})
        </span>
        {v.inconsistent && (
          <span style={{ color: "var(--warn)" }}>{d.inconsistency}</span>
        )}
        <a href={v.pdfUrl} target="_blank" rel="noopener noreferrer">
          {d.sessionPdf} ↗
        </a>
      </span>
    </div>
  );
}

function VotesSection({
  lang,
  person,
  overview,
}: {
  lang: Lang;
  person: Person;
  overview: VoteOverview;
}) {
  const d = t(lang).profile;
  const base = `/${lang}/kandidat/${person.slug}/hlasovania`;
  return (
    <>
      <div className="votes-head">
        {overview.bodies.map((b) =>
          b.terms.map((term) => (
            <span key={b.body + term.from}>
              <b>{b.body}</b> {yearOf(term.from)}–{yearOf(term.to) ?? ""} ·{" "}
              {d.attendance(
                ((term.present / term.total) * 100)
                  .toFixed(1)
                  .replace(".", lang === "en" ? "." : ","),
                term.present,
                term.total,
              )}
            </span>
          )),
        )}
      </div>
      {overview.keyVotes.length > 0 && (
        <>
          <h3 className="eyebrow" style={{ margin: "18px 0 4px" }}>
            {d.keyVotes}
          </h3>
          {overview.keyVotes.map((v) => (
            <VoteRow key={v.factId} lang={lang} v={v} />
          ))}
          <p className="note">
            <Link href={`${base}?kluc=1`} style={{ color: "var(--moon)" }}>
              {d.keyVotes} ({overview.keyTotal}) →
            </Link>{" "}
            · {d.keyVotesRule}
          </p>
        </>
      )}
      <div className="topics" title={d.topicAuto}>
        {overview.topics.map((tp) =>
          tp.votes ? (
            <Link key={tp.code} href={`${base}?tema=${tp.code}`}>
              {tp.name}{" "}
              <small>
                {tp.items} · {tp.votes}
              </small>
            </Link>
          ) : (
            <span key={tp.code}>
              {tp.name} <small>{d.noItems}</small>
            </span>
          ),
        )}
      </div>
      <p className="note">
        <Link href={base} style={{ color: "var(--moon)" }}>
          {d.allVotes(overview.total)} →
        </Link>{" "}
        · {d.topicAuto}
      </p>
    </>
  );
}

function Timeline({ lang, person }: { lang: Lang; person: Person }) {
  const d = t(lang);
  const sectionName = (f: Fact) =>
    d.profile.sections[SECTION_OF[f.type] ?? "media"];
  const dated = person.facts
    .filter((f) => f.from)
    .sort((a, b) => (a.from! < b.from! ? -1 : 1));
  const undated = person.facts.filter((f) => !f.from);
  return (
    <>
      <p className="note">{d.profile.timelineNote}</p>
      <ol className="timeline">
        {dated.map((f) => {
          const text = describe(lang, f);
          return (
            <li key={f.id}>
              <span className="y">{formatDate(f.from)}</span>
              <span className="lab">{sectionName(f)}</span>
              <p>
                <span>{text.title}</span>
                {text.detail && <span className="muted">{text.detail}</span>}
                <SourceLink
                  lang={lang}
                  url={f.sourceUrl}
                  date={f.retrievedAt}
                />
              </p>
            </li>
          );
        })}
        {person.candidacies.map((c) => {
          const title = raceTitle(lang, c.race);
          return (
            <li key={c.id} className="now">
              <span className="y">24. 10. 2026</span>
              <span className="lab">{d.profile.sections.candidacies}</span>
              <p>
                <span>
                  {title.name}{" "}
                  {title.where && (
                    <span className="muted">· {title.where}</span>
                  )}
                </span>
                <SourceLink
                  lang={lang}
                  url={c.sourceUrl}
                  date={c.retrievedAt}
                />
              </p>
            </li>
          );
        })}
        {undated.length > 0 && (
          <li>
            <span className="y">{d.profile.undated}</span>
          </li>
        )}
        {undated.map((f) => {
          const text = describe(lang, f);
          return (
            <li key={f.id}>
              <span className="lab">{sectionName(f)}</span>
              <p>
                <span>{text.title}</span>
                <SourceLink
                  lang={lang}
                  url={f.sourceUrl}
                  date={f.retrievedAt}
                />
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}

async function ProfilePage({
  lang,
  params,
}: {
  lang: Lang;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const person = await getPerson(slug);
  if (!person) notFound();
  const [overview, sourceList] = await Promise.all([
    getVoteOverview(person.id, lang),
    getSources(),
  ]);
  const sources = new Map(sourceList.map((s) => [s.code, s]));
  const d = t(lang);
  const name = `${person.givenName} ${person.familyName}`;
  const first = person.candidacies[0];
  const residence = first?.residence ?? first?.race.municipality ?? null;
  const by = (section: Section) =>
    person.facts.filter((f) => SECTION_OF[f.type] === section);
  const counts: Record<(typeof SECTIONS)[number], number | null> = {
    summary: null,
    candidacies: person.candidacies.length,
    history: by("history").length,
    business: by("business").length,
    votes: overview?.total ?? 0,
    assets: by("assets").length,
    campaign: by("campaign").length,
    media: by("media").length,
    research: null,
    sources: person.sources.length,
  };

  const section = (
    key: (typeof SECTIONS)[number],
    i: number,
    body: React.ReactNode,
  ) => (
    <section key={key} className="sec" id={key}>
      <h2>
        <span className="n">{String(i + 1).padStart(2, "0")}</span>
        {d.profile.sections[key]}
      </h2>
      {body}
    </section>
  );

  const factList = (s: Section) => {
    const facts = by(s);
    return facts.length ? (
      facts.map((f) => <FactCard key={f.id} lang={lang} fact={f} />)
    ) : (
      <Empty lang={lang} person={person} section={s} sources={sources} />
    );
  };

  const bodies: Record<(typeof SECTIONS)[number], React.ReactNode> = {
    summary: <SummaryBlock lang={lang} person={person} />,
    candidacies: (
      <div>
        {person.candidacies.map((c) => {
          const title = raceTitle(lang, c.race);
          return (
            <div key={c.id} className="fact" id={`c-${c.id}`}>
              <div className="row">
                <span className="what">
                  <b>
                    <Link href={`/${lang}/volby/${c.race.slug}`}>
                      {title.name}
                    </Link>
                  </b>
                </span>
                <span className="when">
                  {d.profile.ballotNo} {c.ballotNumber ?? "—"}
                </span>
                <SourceLink
                  lang={lang}
                  url={c.sourceUrl}
                  date={c.retrievedAt}
                />
              </div>
              <p className="detail">
                {[title.where, c.party, c.occupation]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          );
        })}
      </div>
    ),
    history: by("history").length ? (
      <HistoryTable lang={lang} facts={by("history")} />
    ) : (
      <Empty lang={lang} person={person} section="history" sources={sources} />
    ),
    business: factList("business"),
    votes: overview ? (
      <VotesSection lang={lang} person={person} overview={overview} />
    ) : (
      <>
        <Empty lang={lang} person={person} section="votes" sources={sources} />
        <p className="note">{d.profile.votesScope}</p>
      </>
    ),
    assets: factList("assets"),
    campaign: factList("campaign"),
    media: factList("media"),
    research: (
      <>
        <div className="research">
          {researchLinks(name, residence).map((l) => (
            <a
              key={l.target}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                {l.label}
                <small>{l.sub}</small>
              </span>
              ↗
            </a>
          ))}
        </div>
        <p className="note">{d.profile.researchNote}</p>
      </>
    ),
    sources: (
      <ol className="sources">
        {person.sources.map((s) => (
          <li key={s.code}>
            <b>{s.name}</b>
            <small>{s.baseUrl}</small>
            <span className="d">
              {d.profile.retrieved} {formatDate(s.lastRetrieved)}
            </span>
          </li>
        ))}
      </ol>
    ),
  };

  const titlesBefore = first?.titlesBefore;
  const titlesAfter = first?.titlesAfter;
  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}/kandidati`}>{d.nav.candidates}</Link>
        {first && (
          <span>
            <Link href={`/${lang}/volby/${first.race.slug}`}>
              {raceTitle(lang, first.race).name}
            </Link>
          </span>
        )}
        <span>{name}</span>
      </p>
      <div className="prof-hero">
        <div className="who rise d2">
          {titlesBefore && <p className="titles">{titlesBefore}</p>}
          <h1 className="title">
            {name}
            {titlesAfter && <span className="after">, {titlesAfter}</span>}
          </h1>
          <p className="meta">
            <b>{d.profile.age(person.age)}</b>
            {residence && (
              <span>
                {d.profile.residence} <b>{residence}</b>
              </span>
            )}
            {first?.occupation && <span>{first.occupation}</span>}
          </p>
          <div className="cands">
            {person.candidacies.map((c) => {
              const title = raceTitle(lang, c.race);
              return (
                <Link
                  key={c.id}
                  className="cand glass"
                  href={`/${lang}/volby/${c.race.slug}`}
                >
                  <span className="no">{c.ballotNumber ?? "—"}</span>
                  <span>
                    <b>{title.name}</b>
                    <span className="sub">
                      {[title.where, c.party].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="mapcard glass rise d3">
          <div className="mapwrap">
            <MiniMap
              pin={residence}
              label={d.profile.residenceMap(residence ?? "")}
            />
          </div>
          <p>
            <span>{d.profile.residenceNote}</span>
            <b>{residence ?? "—"}</b>
          </p>
        </div>
      </div>

      <ProfileTabs
        labels={[d.profile.tabs.overview, d.profile.tabs.timeline]}
        overview={
          <div className="layout">
            <nav className="toc" aria-label={d.profile.sections.summary}>
              {SECTIONS.map((key) => (
                <a key={key} href={`#${key}`}>
                  {d.profile.sections[key]}
                  {counts[key] !== null && <em>{counts[key]}</em>}
                </a>
              ))}
            </nav>
            <div>{SECTIONS.map((key, i) => section(key, i, bodies[key]))}</div>
          </div>
        }
        timeline={<Timeline lang={lang} person={person} />}
      />
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/kandidat/[slug]">) {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <Suspense fallback={<PageFallback />}>
        <ProfilePage lang={lang} params={params} />
      </Suspense>
    </Shell>
  );
}
