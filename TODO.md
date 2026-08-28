# TODO

## Scripts

- [ ] **Prevent duplicate concurrent runs** — both `psi.mjs` and `crux.mjs` can be started accidentally at the same time with no lock. Consider a simple lockfile (`/tmp/psi.lock`, `/tmp/crux.lock`) or a `running` flag in the DB runs table.
- [ ] **Progress output** — print estimated time remaining during runs (sites done / total × avg ms per site).
- [ ] **Fix JSON corruption in `detect-cms.ts`** — `cms-results.json` had a record truncated mid-write (Hischool: `astroVersion`, `starlightVersion`, `astroSignals` fields lost). Root cause unknown — likely a string with a control character or an interrupted write. Add JSON validation / atomic write (write to tmp file, rename) to prevent silent corruption.
- [ ] **`detect-cms.ts` writes to shared scan history even for scoped test runs** — it unconditionally writes a `scans` row via `writeScanToDb` regardless of `--source`/`--output`, so a scoped/ad-hoc run (e.g. verifying a single-site fix) becomes "the latest scan" that `crux.astro`, `psi.astro`, `insights.astro`, and the homepage all join against. Already corrupted prod data once (2026-08-15, see `CHANGES.md`) — a 1-site test run zeroed out CrUX/PSI results everywhere until manually repaired. Only write the `scans` row for full showcase scans (no `--source`/`--output` override), or gate it behind an explicit flag.
- [x] **`.showcase-cache`'s `origin` (the fork) drifts behind true upstream** — both `detect-cms.ts` and `make-removal-prs.mjs` used to branch/pull from `origin/main`, but `origin` there is the fork, which falls behind as soon as any of our own PRs merge upstream. Caused PRs #2644/#2646 to go conflicting mid-session (branched from a fork 34 commits stale). Fixed 2026-08-25: both scripts now fetch directly from the canonical `withastro/astro.build` URL and branch/reset off `FETCH_HEAD` instead of any named remote. Any future script that branches `.showcase-cache` off `main` should do the same, not trust `origin/main`.

## Showcase PRs

- [ ] **PR #2650** (`withastro/astro.build`) — open, awaiting review.
  - Removes 50 sites with expired/deleted domains (batch 1/3 of the GONE removal)
- [ ] **PR #2651** (`withastro/astro.build`) — open, awaiting review.
  - Removes 50 sites with expired/deleted domains (batch 2/3)
- [ ] **PR #2652** (`withastro/astro.build`) — open, awaiting review.
  - Removes 50 sites with expired/deleted domains (batch 3/3)
  - All 150 sites across the 3 batches verified via dual-DoH NXDOMAIN (Cloudflare + Google), cross-checked against `.scan-history.db` consecutive-failure streaks (min 24 scans, 138/150 at 100+ scans / 3+ months) — see `CHANGES.md`, 2026-08-28
