import { Shell } from "@/components/shell";
import { SearchBox } from "@/components/search-box";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export default async function NotFound() {
  const lang = await getLang();
  const d = t(lang);
  return (
    <Shell lang={lang}>
      <h1 className="title" style={{ marginTop: 60 }}>
        {d.notFound.title}
      </h1>
      <p className="lede">{d.notFound.lede}</p>
      <div style={{ maxWidth: 560, marginTop: 28 }}>
        <SearchBox lang={lang} variant="home" />
      </div>
    </Shell>
  );
}
