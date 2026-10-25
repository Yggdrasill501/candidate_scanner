import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LANGS, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import "../globals.css";

const sans = Geist({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-geist",
});
const mono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
});

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const d = t(await getLang());
  return {
    title: { default: d.htmlTitle, template: `%s · ${d.htmlTitle}` },
    description: d.tagline,
    alternates: {
      languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  // The proxy prefixes every page path with sk, en or hu.
  const lang = await getLang();
  return (
    <html lang={lang} className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
