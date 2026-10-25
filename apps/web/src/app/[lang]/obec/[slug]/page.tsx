import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { RaceCard } from "@/components/race";
import { Shell } from "@/components/shell";
import { getBallot } from "@/lib/data";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { slugify } from "@/lib/names";

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

/**
 * The four races on a voter's ballot. The municipal-council district is picked by hand
 * (?obvod=n); "Neviem" (no obvod) shows every district, each labelled.
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
  const councils =
    picked && ballot.councils.some((c) => c.district === picked)
      ? ballot.councils.filter((c) => c.district === picked)
      : ballot.councils;
  const base = `/${lang}/obec/${m.slug}`;
  return (
    <>
      <p className="crumbs rise d1">
        <Link href={`/${lang}/kandidati#${slugify(m.district)}`}>
          {d.ballot.district} {m.district}
        </Link>
        <span>{m.name}</span>
      </p>
      <h1 className="title rise d2">{m.name}</h1>
      <p className="lede rise d2">{d.home.ballotTitle}</p>

      {ballot.councils.length > 1 && (
        <>
          <div
            className="picker rise d3"
            role="group"
            aria-label={d.ballot.pickDistrict}
          >
            <span className="label">{d.ballot.pickDistrict}</span>
            {ballot.councils.map((c) => (
              <Link
                key={c.slug}
                className="pillbtn"
                href={`${base}?obvod=${c.district}`}
                aria-current={picked === c.district ? "true" : undefined}
              >
                {d.ballot.districtLabel(c.district ?? 0)}
              </Link>
            ))}
            <Link
              className="pillbtn"
              href={base}
              aria-current={!picked ? "true" : undefined}
            >
              {d.ballot.dontKnow}
            </Link>
          </div>
          <p className="note">{d.ballot.noAddressMap}</p>
        </>
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
