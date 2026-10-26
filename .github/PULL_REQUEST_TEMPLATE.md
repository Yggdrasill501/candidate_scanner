## What and why

<!-- What does this change, and why? Link the issue: "Closes #123". -->

## How I verified it

<!-- Commands you ran, pages you checked. For UI: screenshots on phone and desktop.
For data: counts (facts, persons, ambiguous links) and a few examples checked by hand against the source. -->

## Checklist

- [ ] `pnpm check` and `pnpm build` pass
- [ ] Follows the [rules that never bend](../CONTRIBUTING.md#the-rules-that-never-bend): neutral, equal treatment, sourced, match reasons, nothing hidden
- [ ] No birth dates, street addresses or other private identifiers in stored payloads or on pages
- [ ] Schema changed? Migration has a working `down`, and `packages/db/src/schema.ts` is regenerated
- [ ] New source? Added to `docs/sources.md`, respects robots.txt and rate limits
- [ ] User-facing text added in all three languages (sk, en, hu)
