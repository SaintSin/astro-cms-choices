# Astro Showcase — CMS Detector

**Live site: [astro-what-cms.netlify.app](https://astro-what-cms.netlify.app)**

Scans every site in the [Astro showcase](https://astro.build/showcase/) and fingerprints which CMS (if any) is powering it — headless CMSs, page builders, full-site platforms, JS frameworks, and static-site generators.

## What it does

- Fetches all ~3,200 sites listed in the Astro showcase
- Fingerprints each site from HTML and HTTP headers
- Detects whether the site is still running on Astro
- Displays results in a filterable, sortable, paginated table
- [Insights page](/insights) with version distribution and submission trend charts
- [CrUX page](/crux) with Chrome UX Report field data (LCP, INP, CLS, CWV) for Desktop, Phone, and Tablet
- [PSI page](/psi) with PageSpeed Insights Lighthouse scores and lab/field metrics for mobile and desktop

## Detection coverage

| Category              | Examples                                                                                                                                      |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| Headless CMS          | Contentful, Sanity, Storyblok, Prismic, DatoCMS, Hygraph, Strapi, Keystatic, EmDash, microCMS, Builder.io, Tina CMS, Payload, Decap, and more |
| Page builder / hosted | Webflow, Squarespace, Wix, Framer, Shopify, HubSpot, Notion                                                                                   |
| Full-site CMS         | WordPress, Ghost, Drupal, Joomla, Craft CMS, Kirby, Statamic, TYPO3, Umbraco                                                                  |
| JS framework          | Next.js, Nuxt, SvelteKit, Remix                                                                                                               |
| Static-site generator | Starlight, Hugo, Eleventy, Jekyll, Gatsby, Hexo                                                                                               |

Astro detection uses nine independent signals: generator meta tag, Starlight generator tag, `data-astro-*` attributes, `/_astro/` asset paths, `<astro-island>` elements, `:where(.astro-*)` CSS selectors, `data-astro` CSS selectors, `astro-` scoped class names, and legacy `hoisted.js` (pre-2.x). Detection logic is informed by [isAstro](https://github.com/OliverSpeir/isAstro) by Oliver Speir.

Sites behind bot challenges (Cloudflare, sgcaptcha) are recorded as `Blocked` rather than `Unknown`. So are sites that refuse the request with HTTP 401/403/429 (the scanner retries once with a browser-style User-Agent first) and sites only reachable over a plain-HTTP fallback after TLS fails — "couldn't look" is never filed as a confident "not Astro". Error pages (404, 5xx, …) with nothing identifiable in the body are recorded as `Error`, which `--errors-only` retries.

Domains that have been parked, sold, or forwarded to a registrar page (GoDaddy, Sedo, Afternic, etc.) are recorded as `Parked / Forwarded`.

## Getting started

`src/data/cms-results.json` is not committed — generate it before running the dev server:

```bash
pnpm detect   # clones showcase data and scans all sites (~7 min)
pnpm dev      # start dev server
```

## Commands

| Command                  | Action                                                           |
| :----------------------- | :--------------------------------------------------------------- |
| `pnpm dev`               | Start dev server at `localhost:4321`                             |
| `pnpm test`              | Run the unit tests (`node:test`, in `scripts/__tests__/`)        |
| `pnpm detect`            | Scan all showcase sites and write `src/data/cms-results.json`    |
| `pnpm crux`              | Fetch CrUX field data for all confirmed Astro sites              |
| `pnpm psi`               | Fetch PageSpeed Insights scores for all confirmed Astro sites    |
| `pnpm themes`            | Astro themes catalogue: free/paid, demo Astro version, host, PSI |
| `pnpm dns-check`         | Triage persistently-erroring sites via DoH + HTTP HEAD           |
| `pnpm make-prs`          | Prepare batched showcase removal PR branches                     |
| `pnpm recheck-blocked`   | Re-check `Blocked` sites via real Chromium (headless or headed)  |
| `pnpm merge-recheck`     | Apply `recheck-blocked` findings to `cms-results.json` + the DB  |
| `pnpm generate:og-cards` | Regenerate social-share OG card PNGs with live stats             |
| `pnpm db:init`           | Create `.scan-history.db` and all tables (idempotent)            |
| `pnpm db:report`         | Query scan history for trends and anomalies                      |
| `pnpm build`             | Build production site                                            |
| `pnpm preview`           | Preview the production build locally                             |
| `pnpm check`             | Lint and format with Biome (`.astro`/`.ts`/`.js`)                |
| `pnpm fmt`               | Format Markdown/MDX with oxfmt (Biome doesn't cover these)       |
| `pnpm deploy`            | Deploy to Netlify production                                     |
| `pnpm deploy:draft`      | Deploy a draft URL (no prod traffic)                             |
| `pnpm clean`             | Remove `dist` and `.astro` cache                                 |
| `pnpm purge`             | Remove `dist`, `.astro`, `.netlify`, and `node_modules`          |

### `pnpm detect` — CMS scanner

Scans every site in the Astro showcase and fingerprints its CMS stack. Clones `withastro/astro.build` as a sparse checkout into `.showcase-cache/` on first run (`.yml` files only, no screenshots); subsequent runs pull the latest changes.

```bash
pnpm detect                           # scan all ~3,200 sites
pnpm detect -- --limit 50             # scan first 50 only (testing — see note below)
pnpm detect -- --concurrency 8        # parallel fetches (default: 6)
pnpm detect -- --resume               # skip already-processed URLs
pnpm detect -- --errors-only          # re-scan only sites that errored last run
pnpm detect -- --forwarded-only       # re-scan only redirected domains
pnpm detect -- --timeout 15000        # per-site timeout in ms (default: 10000)
pnpm detect -- --source /path/to/yml  # use a different showcase directory
pnpm detect -- --output results.json  # write to a different output file
```

Only a full run over the default showcase directory is authoritative. A partial run (`--limit` without `--resume`/`--errors-only`/`--forwarded-only`, or a non-default `--source`) prints its summary but does **not** overwrite `src/data/cms-results.json` and is **not** saved to scan history — otherwise a 50-site test would replace the full dataset that every page reads as the "latest scan". Pass `--output <scratch file>` to keep a partial run's results.

After running, clear the Astro cache to pick up new data:

```bash
rm -rf .astro && pnpm dev
```

### `pnpm themes` — Astro themes catalogue

Feeds the `/themes/` page. Reads the theme catalogue from `portal.astro.build` (the API behind astro.build/themes; the list endpoint has no demo URLs, so it walks the per-month endpoint, which does), then probes each theme's demo for the Astro version and the web host (from response headers). Stored in `themes` and `theme_psi` in `.scan-history.db`, separate from the showcase tables.

```bash
pnpm themes                          # sync catalogue, probe demos not yet probed
pnpm themes --probe-all              # re-probe every demo
pnpm themes --psi                    # PSI (mobile + desktop) for demos with no result yet
pnpm themes --psi --all              # re-score every theme (adds a row per run; the page shows the latest)
pnpm themes --psi --errors-only      # retry failed PSI runs
pnpm themes --psi --limit=20         # cap themes (testing)
pnpm themes --psi --concurrency=4    # workers per strategy (default: 2)
```

### `pnpm crux` — Chrome UX Report

Fetches 28-day real-user field data (LCP, INP, CLS, FCP, TTFB) at origin level for confirmed Astro sites from the latest scan that PSI has returned a CWV (field data) response for — run `pnpm psi` first, or pass `--all-sites` to query every confirmed Astro site. Tries the bare domain first; falls back to `www.` on 404. Rate-limited to ~120 req/min (safely under the 150/min quota). Estimated ~50 min for a full run.

Requires `CRUX_API_KEY` in `.env`.

```bash
pnpm crux                             # fetch all 3 form factors for every site
pnpm crux -- --form-factor=DESKTOP    # DESKTOP | PHONE | TABLET (default: all 3)
pnpm crux -- --all-sites              # don't limit to sites with a PSI CWV response
pnpm crux -- --new-only               # skip site × form_factor combos fetched today
pnpm crux -- --limit=100              # cap number of sites (testing)
pnpm crux -- --dry-run                # print what would be fetched, write nothing
```

### `pnpm psi` — PageSpeed Insights

Fetches Lighthouse scores (performance, accessibility, best-practices, SEO, Agentic Browsing) plus lab and field metrics (LCP, CLS, INP, TBT) for both mobile and desktop strategies. A PSI request blocks for the full remote Lighthouse run (~22s observed) rather than returning quickly, so concurrency — not the inter-request delay — is what determines wall-clock time. Runs 2 workers per strategy lane by default (4 concurrent requests total), well under Google's rate limit. Estimated ~30 min for a full run (~2,600 sites × 2 strategies) at the default concurrency. Requests retry with backoff on 429/5xx/network errors (honouring `Retry-After`), and a response with no performance score is recorded as an error rather than a success.

Requires `PAGESPEED_API_KEY` in `.env`.

```bash
pnpm psi                              # fetch both strategies for every site
pnpm psi -- --strategy=mobile        # mobile | desktop (default: both)
pnpm psi -- --concurrency=3          # workers per strategy lane (default: 2 — 4 total for both strategies)
pnpm psi -- --new-only               # skip site × strategy combos already fetched (success or error)
pnpm psi -- --errors-only            # retry combos that errored or came back with no score
pnpm psi -- --limit=100              # cap number of sites (testing)
pnpm psi -- --url=https://example.com/  # run a single site only
pnpm psi -- --dry-run                # print what would be fetched, write nothing
```

### `pnpm make-prs` — prepare showcase removal PR branches

Reads confirmed-gone domains from the latest `dns-check` run, matches each to its YAML file in `.showcase-cache`, batches them into groups of 50, and for each batch: creates a branch, deletes the YAMLs, appends to `blockedOrigins`, commits, and pushes to the fork. Saves a `pr-body-*.md` file and prints the `gh pr create` command to submit manually.

```bash
pnpm make-prs                       # prepare branches for all gone domains (batches of 50)
pnpm make-prs -- --batch-size=25    # smaller batches
pnpm make-prs -- --batch=2          # only process batch 2
pnpm make-prs -- --dry-run          # print plan without touching git
```

### `pnpm recheck-blocked` — re-check `Blocked` sites via a real browser

Some sites classified `Blocked` are only rejected by the Node fetch client's TLS fingerprint or a bot-challenge — a real browser can get through. Re-checks every current `Blocked` site through Playwright/Chromium and reuses the exact same classification logic as `pnpm detect` (`fingerprint`/`detectAstro`), so results are directly comparable. Read-only — writes a report, never touches `cms-results.json` or the DB directly (see `pnpm merge-recheck`).

```bash
pnpm recheck-blocked                                    # headless sweep of all Blocked sites
pnpm recheck-blocked -- --limit 20                      # cap sites checked (testing)
pnpm recheck-blocked -- --concurrency 3                 # parallel browser tabs (default: 4)
pnpm recheck-blocked -- --headed --only-still-blocked   # for genuine bot walls — see below
```

For sites that stay `Blocked` even through a headless real browser (CAPTCHA, "verify you're human" interstitials), `--headed` opens a real, visible Chromium window one site at a time and waits for you to solve the challenge yourself, then press Enter in the terminal to capture the page (or type `skip` to move on). `--only-still-blocked` narrows the target list to exactly the sites the last headless sweep left as genuinely blocked, excluding real network/TLS errors that no bot-check-passing fixes.

Any bounded run (`--headed` or `--limit`) writes to `blocked-recheck-report.partial.json` instead of the canonical `blocked-recheck-report.json` — a quick test can't clobber the reference `--only-still-blocked` depends on.

### `pnpm merge-recheck` — apply recheck findings

Applies the `changed` entries from a `recheck-blocked` report onto `cms-results.json` and the DB's current latest scan, without re-running a full `pnpm detect`. Dry-run by default.

```bash
pnpm merge-recheck                                              # dry run — print what would change
pnpm merge-recheck -- --apply                                   # write it
pnpm merge-recheck -- --report blocked-recheck-report.partial.json --apply  # from a --headed run
```

### `pnpm generate:og-cards` — regenerate social-share images

Renders the OG card templates (`scripts/og-templates/og-card.html`, `og-card-crux.html`, `og-card-psi.html`, `og-card-note-astro-vs-nextjs.html`) with live stats from `cms-results.json` and `.scan-history.db`, using Playwright to screenshot each at 1200×630 and write the PNG to `public/images/social/`. Templates live outside `public/` so they're never shipped in the build output — the script reads them directly, they're never served over HTTP. Each template has `{{TOKEN}}` placeholders — the script is the only thing that should edit the numbers; edit the surrounding markup/CSS by hand.

Requires the Playwright Chromium browser (`npx playwright install chromium`, one-time).

```bash
pnpm generate:og-cards               # regenerate all 4 cards
pnpm generate:og-cards -- --card=psi # home | crux | psi | note-astro-vs-nextjs
```

### `pnpm dns-check` — triage error sites

Queries `.scan-history.db` for persistently-erroring sites then classifies each one via DNS over HTTPS lookups against Cloudflare and Google (`scripts/doh.mjs`) followed by an HTTP HEAD request. NXDOMAIN counts only when **both** resolvers agree:

| Result        | Meaning                                                               |
| :------------ | :-------------------------------------------------------------------- |
| `GONE`        | Both DoH resolvers return NXDOMAIN — domain likely expired or deleted |
| `ALIVE`       | DNS resolves + HEAD returns 2xx/3xx — transient error at scan time    |
| `BROKEN`      | DNS resolves + HEAD returns 4xx/5xx — server up but site is broken    |
| `DEAD SERVER` | DNS resolves but connection refused or timed out                      |
| `DNS ERROR`   | DoH lookup failed, or the two resolvers disagreed (inconclusive)      |

```bash
pnpm dns-check                        # check sites erroring in 3+ of last 5 scans
pnpm dns-check -- --scans=8          # wider look-back window (default: 5)
pnpm dns-check -- --min=5            # raise error threshold (default: 3)
pnpm dns-check -- --concurrency=5   # parallel checks (default: 10)
pnpm dns-check -- --limit=50        # cap sites checked (testing)
pnpm dns-check -- --dry-run         # list sites without making network requests
```

### `pnpm db:init` — initialise the database

Creates `.scan-history.db` and all tables. Safe to re-run (idempotent — uses `CREATE TABLE IF NOT EXISTS`). Run once before your first scan, or any time to verify the DB is healthy.

```bash
pnpm db:init
```

### `pnpm db:report` — scan history

Queries `.scan-history.db` for trends and anomalies across scans.

```bash
pnpm db:report                        # scan history summary (default)
pnpm db:report -- --errors            # sites erroring in 3+ of the last 5 scans
pnpm db:report -- --errors --scans 8  # same, look back 8 scans
pnpm db:report -- --errors --min 5    # raise error threshold to 5
pnpm db:report -- --changes           # CMS / Astro changes between last 2 scans
pnpm db:report -- --decay             # Astro sites still on v4 or older
pnpm db:report -- --lost-astro        # sites that migrated away from Astro, with PSI before/after
pnpm db:report -- --fail-streak       # sites currently failing every attempt since their last success
pnpm db:report -- --fail-streak --min 10  # raise the streak threshold (default: 5)
pnpm db:report -- --site example.com  # full scan history for one hostname
pnpm db:report -- --all               # run every report
```

## Project structure

```
├── .showcase-cache/            # Sparse clone of withastro/astro.build (gitignored)
├── scripts/
│   ├── detect-cms.ts           # Detection script (pnpm detect)
│   ├── psi.mjs, crux.mjs       # PageSpeed Insights / CrUX collectors
│   ├── dns-check.mjs, doh.mjs  # Dead-domain triage and the two-resolver DoH lookup
│   ├── fetch-retry.mjs         # fetch with backoff for 429/5xx/network errors
│   ├── make-removal-prs.mjs    # Showcase removal PR branches
│   ├── recheck-blocked.ts, merge-recheck-results.ts
│   ├── db-init.ts, db-report.ts, db-utils.ts
│   ├── generate-og-cards.mjs, og-templates/
│   └── __tests__/              # node:test unit tests (pnpm test)
├── src/
│   ├── components/
│   │   └── showcase/
│   │       ├── ShowcaseTable.astro       # Results table (renders page 1 only)
│   │       ├── ShowcaseRow.astro         # Single <tr> — page 1 and /showcase-rows/
│   │       ├── PsiRow.astro, CruxRow.astro  # Row markup for /psi/ and /crux/
│   │       ├── ShowcaseToolbar.astro     # Filters and search
│   │       └── ShowcasePagination.astro  # Pagination controls
│   ├── config/
│   │   └── siteMetadata.ts     # Site config incl. showcasePageSize
│   ├── data/
│   │   └── cms-results.json    # Generated output (gitignored — run pnpm detect)
│   ├── pages/
│   │   ├── index.astro         # Results UI
│   │   ├── insights.astro      # Version distribution charts
│   │   ├── crux.astro          # Chrome UX Report field data
│   │   ├── psi.astro           # PageSpeed Insights scores
│   │   ├── showcase-rows/      # Prerendered rows after page 1, fetched when idle
│   │   ├── psi-rows/           # Same for /psi/
│   │   ├── crux-rows/          # Same for /crux/
│   │   └── notes/              # Articles
│   ├── utils/
│   │   └── psiData.ts, cruxData.ts  # DB queries shared by a page and its rows endpoint
│   └── types/
│       └── index.ts            # Shared TypeScript types
```

## Tech stack

- [Astro 7](https://astro.build)
- [Chart.js 4](https://www.chartjs.org) for insights charts
- [Biome](https://biomejs.dev) for linting and formatting
- [Turso](https://turso.tech) for analytics storage (via Pandalytics)
- Deployed on [Netlify](https://www.netlify.com)
