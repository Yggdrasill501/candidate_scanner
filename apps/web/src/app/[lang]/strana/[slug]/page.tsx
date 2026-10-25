import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { raceTitle } from "@/components/race";
import { Shell } from "@/components/shell";
import { getParty, type PartyCandidacy } from "@/lib/data";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/strana/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const party = await getParty(slug);
  return party ? { title: party.party.name } : {};
}

/** A party's candidates in the region, grouped by race, each race in ballot order. */
async function PartyPage({
  lang,
  params,
}: {
  lang: Lang;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getParty(slug);
  if (!data) notFound();
  const d = t(lang);
  const races = new Map<string, PartyCandidacy[]>();
  for (const c of data.candidacies)
    races.set(c.race.slug, [...(races.get(c.race.slug) ?? []), c]);
  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}/kandidati`}>{d.nav.candidates}</Link>
        <span>{d.partyPage.eyebrow}</span>
      </p>
      <h1 className="title sm rise d2">{data.party.name}</h1>
      <p className="lede rise d2">
        {d.partyPage.lede(data.candidacies.length)}
      </p>
      <div className="races">
        {[...races.values()].map((list) => {
          const race = list[0]!.race;
          const title = raceTitle(lang, race);
          return (
            <section key={race.slug} className="race glass">
              <header>
                <h2>
                  <Link href={`/${lang}/volby/${race.slug}`}>{title.name}</Link>
                </h2>
                <span className="where">{title.where}</span>
                <span className="facts">
                  <span>
                    <b>{race.candidates}</b> {d.list.stats.candidates}
                  </span>
                </span>
              </header>
              <div className="list">
                {list.map((c) => {
                  const cells = (
                    <>
                      <span className="no">{c.ballotNumber ?? "—"}</span>
                      <span className="nm wide">
                        {c.titlesBefore && (
                          <span className="t">{c.titlesBefore}</span>
                        )}
                        <b>{c.name}</b>
                        {c.titlesAfter && (
                          <span className="t">, {c.titlesAfter}</span>
                        )}
                        {c.label !== data.party.name && (
                          <small>{c.label}</small>
                        )}
                      </span>
                      <span className="go end" aria-hidden="true">
                        →
                      </span>
                    </>
                  );
                  return c.personSlug ? (
                    <Link
                      key={`${c.name}${c.ballotNumber}`}
                      className="r"
                      href={`/${lang}/kandidat/${c.personSlug}`}
                    >
                      {cells}
                    </Link>
                  ) : (
                    <div key={`${c.name}${c.ballotNumber}`} className="r">
                      {cells}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="legend">{d.race.ballotOrder}</p>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/strana/[slug]">) {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <Suspense fallback={<PageFallback />}>
        <PartyPage lang={lang} params={params} />
      </Suspense>
    </Shell>
  );
}
