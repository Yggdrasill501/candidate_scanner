import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/prose";
import { Shell } from "@/components/shell";
import { CONTENT, CORRECTIONS_EMAIL } from "@/lib/content";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CONTENT.opravy[await getLang()].title };
}

// Read-only site: reports go by e-mail; nothing is submitted to or stored by the site.
export default async function Page() {
  const lang = await getLang();
  const doc = CONTENT.opravy[lang];
  return (
    <Shell lang={lang}>
      <p className="crumbs rise d1">
        <Link href={`/${lang}`}>Koho volím</Link>
        <span>{doc.title}</span>
      </p>
      <h1 className="title rise d2">{doc.title}</h1>
      <p className="lede rise d2">{doc.lede}</p>
      <div
        className="callout glass rise d3"
        style={{ maxWidth: 640, marginTop: 28 }}
      >
        <p className="mail">
          ✉{" "}
          <a href={`mailto:${CORRECTIONS_EMAIL}`}>
            <code>{CORRECTIONS_EMAIL}</code>
          </a>
        </p>
      </div>
      <Prose doc={doc} />
    </Shell>
  );
}
