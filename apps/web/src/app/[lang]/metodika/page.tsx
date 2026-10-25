import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/prose";
import { Shell } from "@/components/shell";
import { CONTENT } from "@/lib/content";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CONTENT.metodika[await getLang()].title };
}

export default async function Page() {
  const lang = await getLang();
  const doc = CONTENT.metodika[lang];
  return (
    <Shell lang={lang}>
      <p className="crumbs rise d1">
        <Link href={`/${lang}`}>Koho volím</Link>
        <span>{doc.title}</span>
      </p>
      <h1 className="title rise d2">{doc.title}</h1>
      <p className="lede rise d2">{doc.lede}</p>
      <div className="principles rise d3">
        {doc.principles?.map((p) => (
          <div key={p.k} className="glass">
            <span>{p.k}</span>
            <b>{p.h}</b>
            <p>{p.p}</p>
          </div>
        ))}
      </div>
      <Prose doc={doc} />
    </Shell>
  );
}
