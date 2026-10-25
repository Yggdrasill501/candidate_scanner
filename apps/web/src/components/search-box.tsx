"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchHit, SearchResponse } from "@repo/contract";
import { t, type Lang } from "@/lib/i18n";

const GROUPS = ["person", "party", "municipality", "okres"] as const;

export function hrefFor(lang: Lang, hit: SearchHit): string {
  if (hit.kind === "person") return `/${lang}/kandidat/${hit.slug}`;
  if (hit.kind === "party") return `/${lang}/strana/${hit.slug}`;
  if (hit.kind === "okres") return `/${lang}/kandidati#${hit.slug}`;
  return `/${lang}/obec/${hit.slug}`;
}

/**
 * Live search: grouped results from /api/search while typing, full results page on Enter.
 * "home" is the large line field of the homepage, "header" the compact one in the top bar.
 */
export function SearchBox({
  lang,
  variant,
  samples,
  onFocusHit,
}: {
  lang: Lang;
  variant: "home" | "header";
  samples?: string[];
  onFocusHit?: (hit: SearchHit | null) => void;
}) {
  const d = t(lang).search;
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [sel, setSel] = useState(-1);
  const [placeholder, setPlaceholder] = useState(d.placeholder);

  const flat = res ? GROUPS.flatMap((g) => res[g]) : [];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}&lang=${lang}&limit=6`, {
        signal: ctl.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<SearchResponse>) : null))
        .then((data) => {
          if (data) {
            setRes(data);
            setSel(-1);
          }
        })
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, lang]);

  useEffect(() => {
    onFocusHit?.(sel >= 0 ? (flat[sel] ?? null) : null);
    // flat is derived from res; reporting on selection change is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, res]);

  // "/" focuses the header search from anywhere on the page.
  useEffect(() => {
    if (variant !== "header") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, select")) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [variant]);

  // The homepage placeholder types out example searches.
  useEffect(() => {
    if (
      !samples?.length ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let si = 0,
      ci = 0,
      del = false;
    const timer = setInterval(() => {
      const w = samples[si]!;
      if (!del) {
        ci++;
        if (ci > w.length + 14) del = true;
      } else {
        ci -= 2;
        if (ci <= 0) {
          del = false;
          ci = 0;
          si = (si + 1) % samples.length;
        }
      }
      setPlaceholder(
        w.slice(0, Math.min(ci, w.length)) +
          (ci <= w.length && !del ? "▍" : ""),
      );
    }, 85);
    return () => clearInterval(timer);
  }, [samples]);

  const showList = open && q.trim().length >= 2 && res !== null;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setSel((s) => Math.min(flat.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(-1, s - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setSel(-1);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hit = sel >= 0 ? flat[sel] : undefined;
    const term = q.trim();
    if (hit) router.push(hrefFor(lang, hit));
    else if (term) router.push(`/${lang}/hladat?q=${encodeURIComponent(term)}`);
    setOpen(false);
  }

  let index = -1;
  return (
    <form
      className={`kv-search ${variant === "home" ? "home-search" : "hsearch"}`}
      role="search"
      autoComplete="off"
      onSubmit={onSubmit}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setSel(-1);
        }
      }}
    >
      <div className={variant === "home" ? "line big" : "line"}>
        <span className="arrow" aria-hidden="true">
          →
        </span>
        <label htmlFor={`${id}-q`} className="vh">
          {d.label}
        </label>
        <input
          ref={input}
          id={`${id}-q`}
          name="q"
          type="search"
          value={q}
          placeholder={variant === "home" ? placeholder : d.placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={sel >= 0 ? `${id}-o${sel}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < 2) setRes(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {variant === "home" ? (
          <button type="submit" aria-label={d.submit}>
            ↵
          </button>
        ) : (
          <kbd aria-hidden="true">/</kbd>
        )}
      </div>
      {showList && (
        <ul className="results" id={`${id}-list`} role="listbox">
          {flat.length === 0 && (
            <li className="r-empty">{d.empty(q.trim())}</li>
          )}
          {GROUPS.map((g) =>
            res[g].length ? (
              <li key={g} role="presentation">
                <ul
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                  role="group"
                >
                  <li className="r-group" role="presentation">
                    {d.groups[g]}
                  </li>
                  {res[g].map((hit) => {
                    index++;
                    const i = index;
                    return (
                      <li
                        key={hit.slug}
                        id={`${id}-o${i}`}
                        role="option"
                        aria-selected={sel === i}
                        onMouseEnter={() => setSel(i)}
                      >
                        <Link
                          href={hrefFor(lang, hit)}
                          onClick={() => setOpen(false)}
                        >
                          <span className="r-label">{hit.label}</span>
                          <span className="r-meta">{hit.meta}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ) : null,
          )}
          {flat.length > 0 && (
            <li className="r-all" role="presentation">
              <Link
                href={`/${lang}/hladat?q=${encodeURIComponent(q.trim())}`}
                onClick={() => setOpen(false)}
              >
                {d.showAll} →
              </Link>
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
