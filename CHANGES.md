# Changelog

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
