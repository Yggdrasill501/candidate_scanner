import { Countdown } from "@/components/countdown";
import { HomeMap } from "@/components/map/home-map";
import { Shell } from "@/components/shell";
import { getMunicipalities, getSiteStats } from "@/lib/data";
import { formatNumber, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

// Typed into the search placeholder: places only, so no candidate is singled out.
const SAMPLES = [
  "Želiezovce",
  "Štúrovo",
  "Hurbanovo",
  "Zlaté Moravce",
  "Kolárovo",
  "Nitra",
];

export default async function Home() {
  const lang = await getLang();
  const d = t(lang);
  const [stats, municipalities] = await Promise.all([
    getSiteStats(),
    getMunicipalities(),
  ]);
  return (
    <Shell lang={lang} home>
      <HomeMap
        lang={lang}
        samples={SAMPLES}
        municipalities={municipalities.map(
          ({ name, slug, district, candidates }) => ({
            name,
            slug,
            district,
            candidates,
          }),
        )}
      >
        <Countdown lang={lang} />
        <h1 className="hero rise d2">
          {d.home.h1a}
          <br />
          <span>{d.home.h1b}</span>
        </h1>
        <p
          className="lede rise d3"
          dangerouslySetInnerHTML={{
            __html: d.home.lede(
              formatNumber(lang, stats.people),
              stats.municipalities,
            ),
          }}
        />
      </HomeMap>
      <section className="cards" aria-label={d.home.cards[0]?.k}>
        {d.home.cards.map((c) => (
          <article key={c.k} className="card glass">
            <span className="k">{c.k}</span>
            <h2>{c.h}</h2>
            <p>{c.p}</p>
            <ul>
              {c.rows.map(([k, v]) => (
                <li key={k}>
                  {k} <b>{v}</b>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </Shell>
  );
}
