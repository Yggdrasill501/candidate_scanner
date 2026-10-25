import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/fallback";
import { Shell } from "@/components/shell";
import { search } from "@/lib/data";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang()).search.title, robots: { index: false } };
}

const GROUPS = ["person", "party", "municipality", "okres"] as const;
const PATH = {
  person: "kandidat/",
  party: "strana/",
  municipality: "obec/",
  okres: "kandidati#",
} as const;

async function Results({
  lang,
  searchParams,
}: {
  lang: Lang;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 80) : "";
  const d = t(lang);
  const res = await search(q, 50);
  const total = GROUPS.reduce((n, g) => n + res[g].length, 0);
  return (
    <>
      <h1 className="title sm rise d2">{q ? `„${q}“` : d.search.title}</h1>
      <p className="lede">
        {q.trim().length < 2
          ? d.search.min
          : total
            ? d.search.results(total)
            : d.search.empty(q)}
      </p>
      {GROUPS.map((g) =>
        res[g].length ? (
          <section key={g} className="block">
            <h2>{d.search.groups[g]}</h2>
            <div className="obce wide">
              {res[g].map((h) => (
                <Link key={h.slug} href={`/${lang}/${PATH[g]}${h.slug}`}>
                  {g === "okres" ? d.search.okres(h.label) : h.label}
                  <small>
                    {g === "person" && h.raceKind
                      ? [d.race.kindShort[h.raceKind], h.meta]
                          .filter(Boolean)
                          .join(" · ")
                      : g === "party"
                        ? d.race.candidates(Number(h.meta))
                        : g === "okres"
                          ? d.search.okresMeta(Number(h.meta))
                          : h.meta}
                  </small>
                </Link>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </>
  );
}

export default async function Page({
  searchParams,
}: PageProps<"/[lang]/hladat">) {
  const lang = await getLang();
  return (
    <Shell lang={lang}>
      <p className="crumbs rise d1">
        <Link href={`/${lang}`}>Koho volím</Link>
        <span>{t(lang).search.title}</span>
      </p>
      <Suspense fallback={<PageFallback />}>
        <Results lang={lang} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
