import { NextResponse, type NextRequest } from "next/server";
import { LANGS, type Lang } from "@/lib/i18n";

/** Picks sk, en or hu from Accept-Language, by quality; Slovak when none match. */
function preferred(header: string | null): Lang {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        base: tag.split("-")[0] ?? "",
        q: q ? Number(q.trim().slice(2)) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) {
    if ((LANGS as readonly string[]).includes(base)) return base as Lang;
    if (base === "cs") return "sk";
  }
  return "sk";
}

// Every page lives under /sk, /en or /hu; any other path gets the visitor's language prefix.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if ((LANGS as readonly string[]).includes(first)) return NextResponse.next();
  const lang = preferred(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|geo|favicon.ico|robots.txt|sitemap.xml).*)"],
};
