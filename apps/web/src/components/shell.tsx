import { getSiteStats } from "@/lib/data";
import { formatDate, type Lang } from "@/lib/i18n";
import { SiteFooter, SiteHeader, Sky } from "./site-header";

/** Atmosphere, glass header with search, the page and the sourced footer. */
export async function Shell({
  lang,
  children,
  home = false,
}: {
  lang: Lang;
  children: React.ReactNode;
  home?: boolean;
}) {
  const stats = await getSiteStats();
  return (
    <>
      <Sky cone={home} />
      <div className={home ? "page wide" : "page"}>
        <SiteHeader lang={lang} home={home} />
        {children}
        <SiteFooter lang={lang} dataDate={formatDate(stats.dataDate)} />
      </div>
    </>
  );
}
