# Changelog

## 2026-06-11 (continued)

### UI polish — stat cards, toolbar, footer, social cards

- Added CSS rating tokens `--rating-good/mid/poor` and `*-bg` variants to `_tokens.css`; updated `.score`, `.metric`, and `.legend` classes in `_data-table.css` and `_data-page.css` to use them
- Added `.page-lead` style to `_data-page.css` (`step-0`, full text colour) alongside existing `.page-desc`; applied to CrUX, PSI, and insights pages
- Stat cards made consistent across all pages (index, insights, CrUX, PSI) via shared `_data-page.css` styles — removed local overrides on index and insights pages
- `stat-card--pass` simplified to colour the stat value green via `--rating-good`
- Footer: added Netlify and Astro badges (flex row, `height="45"`) before the GitHub link
- ShowcaseTable: reduced `.col-site` from `auto` to `35ch` to stop pushing the Conf column right
- ShowcaseToolbar: moved search input onto its own line, left-aligned; fixed `align-items` bleed-through from shared layer
- Fixed broken column sort on the home page table (removed stale `.sort-icon` querySelector calls)
- OG social cards: updated home card stats (2,633 sites, 2,133 Astro confirmed); created new dark-theme cards for CrUX (`og-crux.png`) and PSI (`og-psi.png`) pages; images generated via Playwright screenshot

## 2026-06-11

### Run duration tracking

- Added `finished_at` and `duration_ms` columns to `psi_runs` and `crux_runs` tables, matching the pattern already used by `scans`
- Both scripts capture `Date.now()` before the fetch loop and UPDATE the run row on completion
- Migration is automatic: `ALTER TABLE ADD COLUMN` wrapped in try/catch runs on every startup so existing DBs are upgraded silently
- Duration is printed in the completion summary line: `Duration: N.N min`
- Fixed PSI estimated time: was based on delay-only (700ms/job); now uses 22s/job derived from actual run 3 & 4 data (PSI runs Lighthouse remotely — response time dominates)

### PSI `--errors-only` flag

- `pnpm psi -- --errors-only` retries only site × strategy combos with `status = 'error'` in `psi_results`
- `--new-only` already skipped errors (treated them as done) — `--errors-only` is the complement
- Updated `--new-only` description in usage comment to clarify it skips both successes and errors
- README updated with new flag

### README & scripts

- Commands table now includes all scripts: `dns-check`, `make-prs`, `db:init`, `db:report`, `preview`, `deploy`, `deploy:draft`, `clean`, `purge`
- Added `### pnpm db:init` section documenting the idempotent DB initialisation
- Corrected `make-prs` description: prepares branches and saves PR body for manual submission (does not auto-create PRs)

### PR #2460 — showcase URL updates

- Applied delucis's suggested title change: `eva.town.yml` `title: Eva Decker` → `title: Ky Decker`
- Resolved merge conflict with PR #2459 (both inserted into `blockedOrigins` at the same point); rebased onto main with both entry sets preserved
- Pushed updated branch to fork

## 2026-06-10 (continued 3)

### CrUX page — Astro-only filter

- Restricted CrUX results to sites where `astro_detected = 1` in the latest scan — 528 → 514 sites (14 removed that had CrUX data but no confirmed Astro fingerprint)
- Changed `LEFT JOIN scan_results` to `INNER JOIN` now that the filter requires a matching scan row

### Pagination refactor

- Extracted `renderPagination` into `ShowcasePagination.astro` as an `is:inline` script with signature `(container, total, page, pageSize, onPageChange)` — removes ~80 lines of duplicate CSS and ~30 lines of duplicate JS from `crux.astro`
- `ShowcasePagination` now accepts an `id` prop (default `"pagination"`) so the CrUX page can use `id="crux-pagination"` without a separate component

### README

- Added dedicated sections for `pnpm detect`, `pnpm crux`, `pnpm psi`, and `pnpm db:report` with all flags and options documented

## 2026-06-10 (continued 2)

### CrUX page — table layout polish

- Added `<colgroup>` with explicit `<col>` width elements so `table-layout: fixed` distributes all three device groups identically — previously the colspan group headers caused uneven distribution, making Tablet wider than Desktop and Phone
- Switched to IBM Plex Sans (`var(--font-ibm-plex)`) on the CrUX table; added `table-layout: fixed` to prevent layout shift on sort
- Replaced `min-width`/`max-width` pixel values with `ch`-unit fixed widths (`col-site: 28ch`, `col-ver: 8ch`, metric columns: `col-lcp: 6ch`, `col-inp: 7ch`, `col-cls: 6ch`, `col-cwv: 6ch`)
- Set explicit `width: 25ch` on `.col-group-header` (sum of 4 metric cols) so group headers span exactly their columns
- CWV column: widened to `6ch`, added `padding-inline-end` breathing room before the next group's rule, `font-size: var(--step--2)` to keep ✓/✗ symbols compact
- Removed background colours from metric cells — rating now shown via text colour only (green/amber/red)
- Added `col-lcp`, `col-inp`, `col-cls`, `col-cwv` classes to subheader `<th>` and data `<td>` elements for consistent width application

## 2026-06-10 (continued)

### CrUX page

- Added `/crux/` page showing Chrome UX Report field data for 528 confirmed Astro sites
  - Columns: site, Astro version, Desktop/Phone/Tablet — LCP, INP, CLS, CWV pass
  - Metric cells colour-coded by rating (green/amber/red)
  - Sortable columns: all metrics sort no-data rows to the bottom regardless of direction; CWV sorts pass → fail → no-data
  - Search filter by site name or URL
  - Pagination at 50 per page, matching home page style
  - Note explaining sparse tablet data: iPad + Safari dominance means CrUX tablet coverage reflects Chrome-on-Android usage only
  - Zebra-stripe rows, `border-top` row rules and `2px` column group separators matching home page table style
- Added "CrUX CWV" link to site nav

### UI

- Fixed Astro version column sort: sites with no Astro detected now always group at the bottom regardless of sort direction (ascending or descending)
  - Previously, negating the comparison for descending order also flipped the null-handling, scattering no-version rows to the top
  - Fix uses an explicit rank (0 = detected + version, 1 = detected + no version, 2 = not detected) applied before the directional comparison, using `data-astro` to distinguish "detected but no version" from "not detected at all"

### PSI & CrUX data collection

- Added `scripts/psi.mjs` — PageSpeed Insights script for all confirmed Astro sites from the latest scan
  - Fetches Lighthouse scores (performance, accessibility, best-practices, SEO) for both mobile and desktop strategies
  - Captures lab metrics (LCP, CLS, TBT) and field data from `loadingExperience` (LCP, INP, CLS p75 + CWV category)
  - Writes to new `psi_runs` + `psi_results` tables in `.scan-history.db`
  - Rate-limited at 700ms between requests (~85/min); estimated ~100 min for full run (~2,100 sites × 2 strategies)
  - `--new-only` flag skips already-tested site × strategy combos for safe resume after interruption
  - `--strategy=mobile|desktop`, `--limit=N`, `--dry-run` flags
- Added `scripts/crux.mjs` — Chrome UX Report script for all confirmed Astro sites from the latest scan
  - Fetches 28-day real-user field data (LCP, CLS, INP, FCP, TTFB) at origin level for PHONE, DESKTOP, TABLET
  - Tries bare domain first; falls back to `www.` prefix on 404 (genuine low-traffic sites recorded as `no-data`)
  - Writes to new `crux_runs` + `crux_results` tables in `.scan-history.db`
  - Rate-limited at 500ms between requests (~120/min, safely under 150/min CrUX quota); estimated ~53 min for full run
  - `--new-only` skips site × form_factor combos already fetched today
  - `--form-factor=PHONE|DESKTOP|TABLET`, `--limit=N`, `--dry-run` flags
- Added `pnpm psi` and `pnpm crux` scripts to `package.json`
- Added `.env` with `PAGESPEED_API_KEY` and `CRUX_API_KEY` (gitignored)

### Admin review UI — middleware fix

- Fixed `/admin/api/*` routes returning Astro's 404 page in the local dev server
  - Root cause: Astro's `trailingSlashMiddleware` uses `stack.unshift()` to position itself before all Vite connect middleware; with `trailingSlash: "always"`, it rejects paths without a trailing slash (e.g. `/admin/api/queue`) before our middleware could run
  - Fix: on the `'listening'` event, steal the HTTP server's `'request'` event — capture connect's listeners, remove them, re-register a dispatcher that routes `/admin*` directly to our handler and passes everything else to connect unchanged
  - This bypasses the entire Vite/Astro connect stack for admin routes, making it independent of middleware ordering
- Removed `enforce: "pre"` from the plugin (no longer needed with the HTTP-level intercept)

## 2026-06-10

### Code cleanup

- Deleted unused `src/components/global/Link.astro` (not imported anywhere)
- Removed `astro-icon` from `package.json` (unused dependency)
- Added `.fallowrc.json` — suppresses `@astrojs/compiler-rs` false positive (Astro internal peer dep, not directly imported)

### Refactor (`scripts/detect-cms.ts`)

- Extracted `makeParkedDetector(cms, htmlPattern, hostnamePattern)` helper — eliminates repeated parked-domain detector structure across GoDaddy, Sedo, Dan.com, and Afternic entries
- Split 297-line `main()` into four focused helpers:
  - `ensureShowcaseCache()` — git clone/pull logic for the `.showcase-cache/` directory
  - `processSite()` — per-site fetch, fingerprint, and result assembly (was a complex anonymous arrow in the queue)
  - `printSummary()` — CMS frequency table printed after each run
  - `printChanges()` — diff report comparing current run against previous results

## 2026-05-27 (continued)

### Scan history database

- Added local SQLite scan-history database (`.scan-history.db`, gitignored, never deployed)
- Installed `better-sqlite3` as a dev dependency; approved native build in `pnpm-workspace.yaml`
- New scripts:
  - `scripts/db-utils.ts` — shared `openDb()` / `writeScanToDb()` helpers; auto-creates schema on first use
  - `scripts/db-init.ts` — one-time setup and health check (`pnpm db:init`)
  - `scripts/db-report.ts` — query CLI (`pnpm db:report`)
- `detect-cms.ts` now writes every completed scan to the DB automatically (non-fatal — a DB error never breaks a scan)
- Three tables: `scans` (one row per run), `sites` (stable site registry), `scan_results` (one row per site per scan)
- `pnpm db:report` — default shows scan history table
- `pnpm db:report --errors` — sites that errored in 3+ of the last 5 scans (configurable via `--min` and `--scans`)
- `pnpm db:report --changes` — CMS / Astro changes between the last two scans
- `pnpm db:report --decay` — Astro sites grouped by major version, flags v1–v3 specifically
- `pnpm db:report --site <hostname>` — full per-scan history for one site
- `pnpm db:report --all` — runs all reports in sequence
- Existing `cms-results.json` backfilled as scan #1 on first run

### Sort fix

- Fixed Astro version sort (and all column sorts) in the deployed site: `applyView` now reorders rows in the DOM via `tbody.appendChild` in sorted order before applying show/hide, so visible rows appear in correct sequence rather than original JSON insertion order

## 2026-05-27

### Detection (second pass)

- Added Substack detection via `substackcdn.com` and `substack.com/publish` (`full-site`, high confidence) — catches sites that have redirected their custom domain to a Substack publication
- Type column in results table now shows "Redirected domain" vs "Parked domain" separately — previously both labelled "Parked / Forwarded"

### Detection (first pass)

- Fixed Blocked + Astro version contradiction: when `astroDetected` is true, a "Blocked" CMS label (from a Cloudflare challenge overlay on top of real HTML) is now demoted to Unknown. Previously the fix only applied when `astroVersion` was present — updated to use `astro.detected` so sites with signals but no version number (e.g. 1vps.com) are also corrected. Blocked sites dropped from 179 → 39 across the dataset
- Fixed SvelteKit false positive: `\bsveltekit\b` was matching the word in marketing copy. Removed the bare-word match; SvelteKit is now detected only via `__sveltekit_`, `data-sveltekit-`, and `svelte-announcer`
- Added VitePress detection via `<meta name="generator" content="VitePress ...">` (`static-gen` type)

### UI

- CMS column now shows meaningful status badges instead of internal labels:
  - "Blocked" → **Bot-protected** (yellow) — Cloudflare or similar challenge detected
  - "Error" → **Fetch error** (grey) — site unreachable at scan time
  - "Forwarded" → **Redirected** (blue) — domain redirects to a different hostname
  - Unknown and parked entries show nothing
- Breakdown list now filters to actual CMS/framework types only (`headless-cms`, `page-builder`, `full-site`, `framework`, `static-gen`) — Forwarded, Parked, and Unknown entries no longer appear
- Toolbar: split single "Parked" button into two distinct filters:
  - **Redirected domains** (blue) — filters by `cms === "Forwarded"`
  - **Parked domains** (yellow) — filters genuinely parked/expired domains only

### PR workflow (withastro/astro.build)

- First PR merged: [#2409](https://github.com/withastro/astro.build/pull/2409) — removed 77 sites no longer running Astro (76 confirmed migrations + jak2k.schwanenberg.name per issue #2408)
- All removed domains added to `blockedOrigins` in `scripts/update-showcase.mjs` so weekly CI skips re-checking them
- PR process documented in `REVIEW-NOTES.md`

## 2026-05-20

### Detection

- Broadened Astro signals from 5 to 8, drawing on patterns from [isAstro](https://github.com/OliverSpeir/isAstro) by Oliver Speir:
  - `data-astro-*` attributes (previously only `data-astro-cid-*`)
  - `:where(.astro-*)` CSS selector blocks
  - `astro-` prefixed scoped class names on elements
- Expanded bot-challenge detection beyond Cloudflare: `cdn-cgi/challenge-platform`, `_cf_chl_opt`, `cf-spinner`, sgcaptcha redirect patterns
- Added cookie-collection redirect handling: sites that issue cookies on the initial redirect are now fetched in two passes (manual → collect cookies → follow with cookies), rescuing sites previously seen as bot-blocked
- Added `starlightVersion` extraction from generator meta tag — scraped for all Starlight sites
- Scan diff report: after each full run, prints newly detected Astro sites, sites no longer detected, version changes, and CMS changes compared to the previous results file

### Insights page

- Added Starlight version distribution doughnut chart — groups 241 Starlight sites into recency bands:
  - v1+ / v0.37–v0.39 (recent) / v0.32–v0.36 / v0.28–v0.31 / v0.25–v0.27 / v0.24 and older
- Renamed "No version" label to "unknown" throughout
- Fixed stacked bar chart title: "Submission year vs Astro version in use" (was "vs current version", which implied the latest Astro release)
- Doughnut tooltips now show percentage alongside count
- Switched to single-column chart layout (was two-column grid)
- Consistent frontmatter structure (`meta` object, `Layout` alias) matching `index.astro`

### UI

- Per-row isAstro test link in results table: hovering any row reveals a `test ↗` link that opens `isastro.pages.dev/?url=<hostname>` in a new tab
- Table bottom-border fix: switched `td` from `border-bottom` to `border-top` so the last visible row on any paginated page never shows a trailing rule
- Table key added below results explaining the orange full-site row highlight
- Homepage About section: brief description of what the site does, link to submit to the Astro Showcase, and expandable "About this data" details block

### Bug fixes

- Fixed SvelteKit false positive: `\bsveltekit\b` was matching the word in marketing copy on non-SvelteKit sites (e.g. "deploy SvelteKit apps with ease"). Removed the bare word match; SvelteKit is now detected only via `__sveltekit_`, `data-sveltekit-`, and `svelte-announcer` — all runtime-injected signals that don't appear in body text
- Added VitePress detection (`<meta name="generator" content="VitePress ...">`) as `static-gen` type

### Acknowledgements

- Astro detection logic informed by [isAstro](https://github.com/OliverSpeir/isAstro) — Oliver Speir's standalone Astro detector

## 2026-05-17

### Deployment

- Site live at [astro-what-cms.netlify.app](https://astro-what-cms.netlify.app)

### Detection

- Added JS framework detection: Next.js (Pages Router `__NEXT_DATA__` and App Router `__next_f`, `/_next/static/`), Nuxt (`id="__nuxt"`, `__NUXT_DATA__`, `/_nuxt/`), SvelteKit (`__sveltekit_`, `data-sveltekit-`, `svelte-announcer`), Remix (`__remixContext`, `/_build/entry.client.`)
- Added `framework` CMS type to taxonomy alongside `headless-cms`, `page-builder`, `full-site`, `static-gen`
- Added Starlight as a detected CMS (`static-gen` type); Starlight generator tag now also counts as an Astro signal
- Fixed generator meta tag matching for minified HTML where `content` attribute appears before `name` (e.g. `<meta content="Astro v5" name=generator>`) — replaced regex with `hasGeneratorTag()` using `matchAll`
- Fixed WordPress detection: `wp-content/uploads/` alone no longer triggers `full-site`; only `wp-content/themes/`, `wp-content/plugins/`, and `wp-includes/` confirm a full WordPress render
- Added Cloudflare challenge detection (`cf-mitigated: challenge`, `cf_chl_opt`, "Just a moment" title + `cf-ray` header)

### Astro detection signals

Five independent signals used to confirm Astro:

1. Generator meta tag (`<meta name="generator" content="Astro ...">`)
2. Starlight generator tag (Starlight is Astro-native)
3. `data-astro-cid-*` scoped CSS attributes
4. `/_astro/` asset paths
5. `<astro-island>` element

### Showcase data management

- `pnpm detect` now auto-clones `withastro/astro.build` as a sparse checkout into `.showcase-cache/` on first run; subsequent runs do a `git pull` to pick up new entries
- Sparse checkout scoped to `src/content/showcase/*.yml` only — skips the ~2,600 webp screenshots, halving download size
- Default source path changed from `/tmp/astro-build-showcase` (lost on reboot) to `.showcase-cache/` inside the repo (gitignored, persistent)

### Bug fixes

- Fixed `docs.astro.build` not detected as Astro: the site serves a `<meta http-equiv="refresh">` client-side redirect to `/en/getting-started/` rather than an HTTP redirect. `fetchSite()` now detects meta-refresh tags and follows them with a second request, exposing the real page content

### UI

- Stats cards: total scanned, Astro confirmed, Astro not detected, sites with CMS detected, fetch errors
- Breakdown bar chart showing all identified CMSs (Unknown/Error/Blocked excluded)
- Clickable bar chart rows filter the results table
- Toolbar quick-filters: Starlight, JS Frameworks (filters all `framework` type), Parked, Astro not detected
- Column sorting on Site, Astro version, CMS, and Type columns
- Pagination (50 sites per page, configurable via `showcasePageSize` in `src/config/siteMetadata.ts`)
- Search by site title or URL
- CMS type badges colour-coded by category (blue = headless, purple = page builder, red = full-site, cyan = framework, green = static gen, yellow = parked)
- Orange row highlight for `full-site` rows (sites no longer running Astro)
- "Sites with CMS detected" stat label (was "CMS identified" — ambiguous)
- Removed Categories column from results table

### Refactor

- Decomposed monolithic `index.astro` into three focused components: `ShowcaseTable`, `ShowcaseToolbar`, `ShowcasePagination`
- Shared types extracted to `src/types/index.ts` (`CmsResult`, `ResultsFile`, `CMS_TYPE_LABELS`)
- Pagination styling adapted from real-estate project design system (violet active page, uppercase prev/next)

### Assets

- Added Open Graph social card image (`public/images/social/generic-social-1200x630.png`) — dark background, violet gradient, stats row, CMS type bar strip and category pills
- Source HTML for the card kept at `public/og-card.html` for future regeneration

### Data

- `src/data/cms-results.json` moved to `.gitignore` — it is a generated artefact; run `pnpm detect` to produce it locally
- `sourceDir` field in `cms-results.json` now stored as a project-relative path (e.g. `.showcase-cache/src/content/showcase`) rather than an absolute filesystem path

### Insights page

- New `/insights` page with Chart.js visualisations:
  - Doughnut chart: Astro major version distribution across all detected sites
  - Stacked bar chart: submission year vs current Astro version — shows which cohorts have kept up to date
  - Summary stats: sites on v5+, on v6/v7 (current), still on v1–v3, no version detected
- Chart.js installed as a dependency; data passed server-side via `<script type="application/json">` to avoid `define:vars` encoding issues

### Navigation

- Header uncommented and wired up with site name link and nav
- `HeaderNav` now driven from `siteMetadata.menu` — single source of truth for navigation links
- Astro version column sort updated to use proper semver comparison (fixes `4.9.0` vs `4.10.0` ordering)
- Table column widths fixed with `ch` units and `table-layout: fixed` — no more layout shift when sorting
- Sortable columns show `⇅` indicator by default, switching to `▲`/`▼` when active
- Footer: GitHub repo link and icon aligned right; copyright left

### Analytics

- Added Pandalytics analytics (`netlify/functions/pandalytics.ts`) — tracks Core Web Vitals to Turso via Netlify function
- `Analytics.astro` component added to `BaseLayout`
- Site linked to Netlify CLI for `netlify deploy` with function support
