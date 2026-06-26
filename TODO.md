# TODO

## Scripts

- [ ] **Prevent duplicate concurrent runs** — both `psi.mjs` and `crux.mjs` can be started accidentally at the same time with no lock. Consider a simple lockfile (`/tmp/psi.lock`, `/tmp/crux.lock`) or a `running` flag in the DB runs table.
- [ ] **Progress output** — print estimated time remaining during runs (sites done / total × avg ms per site).
- [ ] **Fix JSON corruption in `detect-cms.ts`** — `cms-results.json` had a record truncated mid-write (Hischool: `astroVersion`, `starlightVersion`, `astroSignals` fields lost). Root cause unknown — likely a string with a control character or an interrupted write. Add JSON validation / atomic write (write to tmp file, rename) to prevent silent corruption.

## Showcase PRs

- [ ] **PR #2460** (`withastro/astro.build`) — still open, awaiting review/merge from delucis.
  - Updates URLs for 37 showcase sites that redirected to new domains (entries stay in showcase, just new `url:` values)
  - Removes 3 sites that redirected away from Astro entirely, with their old domains added to `blockedOrigins` in `scripts/update-showcase.mjs`
  - Response to delucis's `blockedOrigins` question already posted — waiting on his sign-off
  - Branch is on fork, rebased and pushed after resolving merge conflict with PR #2459
- [ ] **PR #2494** (`withastro/astro.build`) — open, awaiting review.
  - Removes 7 sites confirmed to have migrated to Framer (YAML + webp deleted, domains added to `blockedOrigins`)
  - Each site verified via isastro.dev link in PR body
