import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { Shell } from "@/components/shell";
import {
  getPerson,
  getPersonVotes,
  getTopics,
  type PersonVote,
} from "@/lib/data";
import { clip, formatDate, t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/kandidat/[slug]/hlasovania">): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLang();
  const person = await getPerson(slug);
  return person
    ? {
        title: `${t(lang).profile.votesPage} · ${person.givenName} ${person.familyName}`,
      }
    : {};
}

const PAGE = 100;

/** Votes grouped by agenda item (material number or item title), items newest first. */
function byItem(votes: PersonVote[]) {
  const items = new Map<string, PersonVote[]>();
  for (const v of votes) {
    const key = `${v.sessionSlug}|${v.material ?? v.itemTitle ?? v.voteNumber}`;
    items.set(key, [...(items.get(key) ?? []), v]);
  }
  return [...items.values()];
}

async function VotesPage({
  lang,
  params,
  searchParams,
}: {
  lang: Lang;
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const person = await getPerson(slug);
  if (!person) notFound();
  const topics = await getTopics(lang);
  const d = t(lang);
  const name = `${person.givenName} ${person.familyName}`;
  const base = `/${lang}/kandidat/${person.slug}/hlasovania`;
  const topic =
    typeof query.tema === "string" && topics.some((x) => x.code === query.tema)
      ? query.tema
      : undefined;
  const key = query.kluc === "1";
  const pageNo = Math.max(1, Number(query.strana) || 1);
  const { total, votes } = await getPersonVotes(
    person.id,
    { topic, key },
    pageNo,
    PAGE,
  );
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    if (topic) q.set("tema", topic);
    if (key) q.set("kluc", "1");
    if (n > 1) q.set("strana", String(n));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };
  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}/kandidat/${person.slug}`}>{name}</Link>
        <span>{d.profile.votesPage}</span>
      </p>
      <h1 className="title sm rise d2">
        {d.profile.votesPage} · {name}
      </h1>
      <p className="lede">
        {topic
          ? topics.find((x) => x.code === topic)?.name
          : key
            ? d.profile.keyVotes
            : d.profile.allTopics}{" "}
        · {total}
      </p>
      <div className="picker" role="group">
        <Link
          className="pillbtn"
          href={base}
          aria-current={!topic && !key ? "true" : undefined}
        >
          {d.profile.allTopics}
        </Link>
        <Link
          className="pillbtn"
          href={`${base}?kluc=1`}
          aria-current={key ? "true" : undefined}
        >
          {d.profile.keyOnly}
        </Link>
        {topics.map((x) => (
          <Link
            key={x.code}
            className="pillbtn"
            href={`${base}?tema=${x.code}`}
            aria-current={topic === x.code ? "true" : undefined}
          >
            {x.name}
          </Link>
        ))}
      </div>
      <p className="note">
        {d.profile.topicAuto} · {d.profile.counts}
        {key ? ` · ${d.profile.keyVotesRule}` : ""}
      </p>
      {votes.length === 0 && <p className="empty">{d.profile.noItems}</p>}
      {byItem(votes).map((item) => {
        const first = item[0]!;
        return (
          <section key={first.factId} className="item">
            <h3>{first.itemTitle ?? clip(first.description)}</h3>
            <p className="sub">
              {first.material && `Mat. č. ${first.material} · `}
              {d.profile.session(
                first.sessionNumber,
                formatDate(first.sessionDate),
              )}{" "}
              · {first.body}
            </p>
            {item.map((v) => (
              <div key={v.factId} className="vote">
                <span className="desc">
                  #{v.voteNumber} {clip(v.description)}
                </span>
                <span className="ch">{d.profile.choice[v.choice]}</span>
                <span className="meta2">
                  <span title={d.profile.counts}>
                    ({v.counts.map((n) => n ?? "?").join(" : ")})
                  </span>
                  {v.inconsistent && (
                    <span style={{ color: "var(--warn)" }}>
                      {d.profile.inconsistency}
                    </span>
                  )}
                  <a href={v.pdfUrl} target="_blank" rel="noopener noreferrer">
                    {d.profile.sessionPdf} ↗
                  </a>
                </span>
              </div>
            ))}
          </section>
        );
      })}
      {pages > 1 && (
        <nav className="picker" aria-label={d.profile.votesPage}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              className="pillbtn"
              href={pageHref(n)}
              aria-current={n === pageNo ? "page" : undefined}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/kandidat/[slug]/hlasovania">) {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <Suspense fallback={<PageFallback />}>
        <VotesPage lang={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
