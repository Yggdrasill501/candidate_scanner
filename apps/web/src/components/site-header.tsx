"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LANGS, t, type Lang } from "@/lib/i18n";
import { SearchBox } from "./search-box";

const NAV = [
  ["vysledky", "results"],
  ["kandidati", "candidates"],
  ["metodika", "method"],
  ["zdroje", "sources"],
  ["opravy", "corrections"],
] as const;

/** The same path in another language; query and hash stay as they are. */
function LangSwitch({ lang }: { lang: Lang }) {
  const path = usePathname();
  const query = useSearchParams().toString();
  const rest = path.replace(/^\/(sk|en|hu)(?=\/|$)/, "");
  return (
    <div className="seg" aria-label={t(lang).langName}>
      {LANGS.map((l) => (
        <a
          key={l}
          href={`/${l}${rest}${query ? `?${query}` : ""}`}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? "true" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </div>
  );
}

function StaticLangSwitch({ lang }: { lang: Lang }) {
  return (
    <div className="seg" aria-label={t(lang).langName}>
      {LANGS.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? "true" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </div>
  );
}

function NavLinks({ lang, path }: { lang: Lang; path: string | null }) {
  const d = t(lang);
  return NAV.map(([seg, key]) => (
    <Link
      key={seg}
      href={`/${lang}/${seg}`}
      aria-current={path?.startsWith(`/${lang}/${seg}`) ? "page" : undefined}
    >
      {d.nav[key]}
    </Link>
  ));
}

function CurrentNavLinks({ lang }: { lang: Lang }) {
  return <NavLinks lang={lang} path={usePathname()} />;
}

export function SiteHeader({
  lang,
  home = false,
}: {
  lang: Lang;
  home?: boolean;
}) {
  return (
    <header className={`bar glass${home ? "home" : ""}`}>
      <Link className="brand" href={`/${lang}`}>
        <i aria-hidden="true" />
        Koho volím
      </Link>
      <nav aria-label={t(lang).nav.label}>
        <Suspense fallback={<NavLinks lang={lang} path={null} />}>
          <CurrentNavLinks lang={lang} />
        </Suspense>
      </nav>
      {home ? (
        <span className="spacer" />
      ) : (
        <SearchBox lang={lang} variant="header" />
      )}
      <Suspense fallback={<StaticLangSwitch lang={lang} />}>
        <LangSwitch lang={lang} />
      </Suspense>
    </header>
  );
}

export function SiteFooter({
  lang,
  dataDate,
}: {
  lang: Lang;
  dataDate: string;
}) {
  const d = t(lang);
  return (
    <footer className="site">
      <span>
        {d.footer.data(dataDate)} · {d.footer.neutral}
      </span>
      <span>
        <Link href={`/${lang}/metodika`}>{d.nav.method}</Link> ·{" "}
        <Link href={`/${lang}/zdroje`}>{d.nav.sources}</Link> ·{" "}
        <Link href={`/${lang}/opravy`}>{d.footer.report}</Link>
      </span>
    </footer>
  );
}

export function Sky({ cone = false }: { cone?: boolean }) {
  return (
    <div className="sky" aria-hidden="true">
      <div className="halo" />
      {cone && <div className="cone" />}
      <div className="grain" />
    </div>
  );
}
