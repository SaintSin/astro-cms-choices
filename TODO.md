# TODO

## Scripts

- [ ] **Prevent duplicate concurrent runs** — both `psi.mjs` and `crux.mjs` can be started accidentally at the same time with no lock. Consider a simple lockfile (`/tmp/psi.lock`, `/tmp/crux.lock`) or a `running` flag in the DB runs table.
- [ ] **Progress output** — print estimated time remaining during runs (sites done / total × avg ms per site).
- [ ] **Fix JSON corruption in `detect-cms.ts`** — `cms-results.json` had a record truncated mid-write (Hischool: `astroVersion`, `starlightVersion`, `astroSignals` fields lost). Root cause unknown — likely a string with a control character or an interrupted write. Add JSON validation / atomic write (write to tmp file, rename) to prevent silent corruption.
- [ ] **`detect-cms.ts` writes to shared scan history even for scoped test runs** — it unconditionally writes a `scans` row via `writeScanToDb` regardless of `--source`/`--output`, so a scoped/ad-hoc run (e.g. verifying a single-site fix) becomes "the latest scan" that `crux.astro`, `psi.astro`, `insights.astro`, and the homepage all join against. Already corrupted prod data once (2026-08-15, see `CHANGES.md`) — a 1-site test run zeroed out CrUX/PSI results everywhere until manually repaired. Only write the `scans` row for full showcase scans (no `--source`/`--output` override), or gate it behind an explicit flag.

## Showcase PRs

- [ ] **PR #2644** (`withastro/astro.build`) — open, awaiting review.
  - Removes `aidailynews.io` — domain repurposed in place (no redirect) to serve WordPress-built Vietnamese gambling content
- [ ] **PR #2645** (`withastro/astro.build`) — open, awaiting review.
  - Updates `url:` for 10 sites that moved domains but are still running Astro
  - Removes `room-tba.uplbtools.me` as a duplicate of the already-listed `room-tba.uplb.tools`
  - Flags 7 sites redirecting to `ozgur.ca/project/*` subpages for maintainer input (editorial call on whether they deserve separate listings) — intentionally left untouched
- [ ] **PR #2646** (`withastro/astro.build`) — open, awaiting review.
  - Removes `aigentic.blog` and `astromade.studio` — both domains lapsed and are now Porkbun marketplace "for sale" pages
