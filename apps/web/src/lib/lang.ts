import { lang as langParam } from "next/root-params";
import { isLang, type Lang } from "./i18n";

/** The page language from the /[lang] root segment; the root layout already 404s others. */
export async function getLang(): Promise<Lang> {
  const lang = await langParam();
  return isLang(lang) ? lang : "sk";
}
