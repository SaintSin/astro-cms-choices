# TODO

## Scripts

- [ ] **Record run duration in `crux_runs` and `psi_runs`** — add `finished_at` and `duration_ms` columns (matching `scans` table). Capture start time at script open, write both fields on completion. Useful for estimating remaining time on incremental `--new-only` runs and spotting API slowdowns. (`scans` already does this — bring `crux_runs` / `psi_runs` in line.)
- [x] **`pnpm dns-check`** — DNS + HTTP triage for error sites (DoH + HEAD, classifies as gone/alive/broken/dead-server)
- [x] **`pnpm make-prs`** — batched showcase removal PRs (50/batch, blockedOrigins update, gh pr create)
- [ ] **Prevent duplicate concurrent runs** — both `psi.mjs` and `crux.mjs` can be started accidentally at the same time with no lock. Consider a simple lockfile (`/tmp/psi.lock`, `/tmp/crux.lock`) or a `running` flag in the DB runs table.
- [ ] **Progress output** — print estimated time remaining during runs (sites done / total × avg ms per site).

## CrUX page

- [ ] **Re-run CrUX after next detect scan** — current data is from the same run that included non-Astro sites; a fresh `pnpm crux --new-only` after the next `pnpm detect` will give a cleaner baseline.

## PSI page

- [ ] **Add `/psi/` page** — similar to `/crux/` but showing Lighthouse scores (performance, accessibility, best-practices, SEO) from `psi_results`. Sortable by score, filterable by strategy.

## Showcase PRs

- [ ] **PR #2460** — still open, awaiting review/merge from delucis.
