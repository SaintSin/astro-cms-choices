# TODO

## Scripts

- [x] **Record run duration in `crux_runs` and `psi_runs`** — add `finished_at` and `duration_ms` columns (matching `scans` table). Capture start time at script open, write both fields on completion. Useful for estimating remaining time on incremental `--new-only` runs and spotting API slowdowns. (`scans` already does this — bring `crux_runs` / `psi_runs` in line.)
- [x] **`pnpm dns-check`** — DNS + HTTP triage for error sites (DoH + HEAD, classifies as gone/alive/broken/dead-server)
- [x] **`pnpm make-prs`** — batched showcase removal PRs (50/batch, blockedOrigins update, gh pr create)
- [ ] **Prevent duplicate concurrent runs** — both `psi.mjs` and `crux.mjs` can be started accidentally at the same time with no lock. Consider a simple lockfile (`/tmp/psi.lock`, `/tmp/crux.lock`) or a `running` flag in the DB runs table.
- [ ] **Progress output** — print estimated time remaining during runs (sites done / total × avg ms per site).

## CrUX page

- [ ] **Re-run CrUX after next detect scan** — current data is from the same run that included non-Astro sites; a fresh `pnpm crux --new-only` after the next `pnpm detect` will give a cleaner baseline.

## PSI page

- [ ] **Add `/psi/` page** — similar to `/crux/` but showing Lighthouse scores (performance, accessibility, best-practices, SEO) from `psi_results`. Sortable by score, filterable by strategy.

## Showcase PRs

- [ ] **PR #2460** (`withastro/astro.build`) — still open, awaiting review/merge.
  - Updates URLs for 37 showcase sites that redirected to new domains (entries stay in showcase, just new `url:` values)
  - Removes 3 sites that redirected away from Astro entirely, with their old domains added to `blockedOrigins` in `scripts/update-showcase.mjs`
  - Reviewer `delucis` asked whether the old URLs of the 37 *changed* sites also need `blockedOrigins` — answer is **no**, those entries aren't being removed, old domains vanish naturally once the PR merges
  - Pending response to post: *"Good point — the old/source URLs for the changed entries don't need `blockedOrigins` since those entries are staying in the showcase, just with updated URLs. Once this merges, the old domains simply won't appear in the upstream source anymore. `blockedOrigins` is really for entries being removed entirely, to prevent them resurfacing via automated scanning. Happy to add them if you feel differently though!"*
  - Branch is on fork, rebased and pushed after resolving merge conflict with PR #2459

## PSI nav link

- [ ] Add `{ label: "Lighthouse", href: "/psi/" }` to `siteMetadata.menu` in site config (deferred until after deploy settles)
