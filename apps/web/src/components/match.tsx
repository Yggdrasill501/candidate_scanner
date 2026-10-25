import type { MatchReason } from "@/lib/data";
import { matchChips, needsMatchReason } from "@/lib/facts";
import { t, type Lang } from "@/lib/i18n";

/** "Zhoda: ✓ meno · ✓ obec · – vek" — shown under every fact linked by name. */
export function Match({ lang, reason }: { lang: Lang; reason: MatchReason }) {
  if (!needsMatchReason(reason)) return null;
  const chips = matchChips(lang, reason);
  if (!chips.length) return null;
  return (
    <p className="match">
      <span>{t(lang).profile.match}</span>
      {chips.map((c) => (
        <span key={c.label} className={`m ${c.kind}`}>
          {c.label}
        </span>
      ))}
    </p>
  );
}
