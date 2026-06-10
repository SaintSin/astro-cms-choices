# Astro Showcase — CMS Detector

**Live site: [astro-what-cms.netlify.app](https://astro-what-cms.netlify.app)**

Scans every site in the [Astro showcase](https://astro.build/showcase/) and fingerprints which CMS (if any) is powering it — headless CMSs, page builders, full-site platforms, JS frameworks, and static-site generators.

## What it does

- Fetches all ~2,600 sites listed in the Astro showcase
- Fingerprints each site from HTML and HTTP headers
- Detects whether the site is still running on Astro
- Displays results in a filterable, sortable, paginated table
- [Insights page](/insights) with version distribution and submission trend charts
- [CrUX page](/crux) with Chrome UX Report field data (LCP, INP, CLS, CWV) for Desktop, Phone, and Tablet

## Detection coverage

| Category              | Examples                                                                                                                    |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| Headless CMS          | Contentful, Sanity, Storyblok, Prismic, DatoCMS, Hygraph, Strapi, Keystatic, Builder.io, Tina CMS, Payload, Decap, and more |
| Page builder / hosted | Webflow, Squarespace, Wix, Framer, Shopify, HubSpot, Notion                                                                 |
| Full-site CMS         | WordPress, Ghost, Drupal, Joomla, Craft CMS, Kirby, Statamic, TYPO3, Umbraco                                                |
| JS framework          | Next.js, Nuxt, SvelteKit, Remix                                                                                             |
| Static-site generator | Starlight, Hugo, Eleventy, Jekyll, Gatsby, Hexo                                                                             |

Astro detection uses eight independent signals: generator meta tag, Starlight generator tag, `data-astro-*` attributes, `/_astro/` asset paths, `<astro-island>` elements, `:where(.astro-*)` CSS selectors, `astro-` scoped class names, and legacy `hoisted.js` (pre-2.x). Detection logic is informed by [isAstro](https://github.com/OliverSpeir/isAstro) by Oliver Speir.

Sites behind bot challenges (Cloudflare, sgcaptcha) are recorded as `Blocked` rather than `Unknown`.

Domains that have been parked, sold, or forwarded to a registrar page (GoDaddy, Sedo, Afternic, etc.) are recorded as `Parked / Forwarded`.

## Getting started

`src/data/cms-results.json` is not committed — generate it before running the dev server:

```bash
pnpm detect   # clones showcase data and scans all sites (~20 min)
pnpm dev      # start dev server
```

## Commands

| Command             | Action                                                        |
| :------------------ | :------------------------------------------------------------ |
| `pnpm dev`          | Start dev server at `localhost:4321`                          |
| `pnpm detect`       | Scan all showcase sites and write `src/data/cms-results.json` |
| `pnpm crux`         | Fetch CrUX field data for all confirmed Astro sites           |
| `pnpm psi`          | Fetch PageSpeed Insights scores for all confirmed Astro sites |
| `pnpm dns-check`    | Triage persistently-erroring sites via DoH + HTTP HEAD        |
| `pnpm make-prs`     | Prepare batched showcase removal PR branches                  |
| `pnpm db:init`      | Create `.scan-history.db` and all tables (idempotent)         |
| `pnpm db:report`    | Query scan history for trends and anomalies                   |
| `pnpm build`        | Build production site                                         |
| `pnpm preview`      | Preview the production build locally                          |
| `pnpm check`        | Lint and format with Biome                                    |
| `pnpm deploy`       | Deploy to Netlify production                                  |
| `pnpm deploy:draft` | Deploy a draft URL (no prod traffic)                          |
| `pnpm clean`        | Remove `dist` and `.astro` cache                              |
| `pnpm purge`        | Remove `dist`, `.astro`, `.netlify`, and `node_modules`       |

### `pnpm detect` — CMS scanner

Scans every site in the Astro showcase and fingerprints its CMS stack. Clones `withastro/astro.build` as a sparse checkout into `.showcase-cache/` on first run (`.yml` files only, no screenshots); subsequent runs pull the latest changes.

```bash
pnpm detect                           # scan all ~2,600 sites
pnpm detect -- --limit 50             # scan first 50 only (testing)
pnpm detect -- --concurrency 8        # parallel fetches (default: 6)
pnpm detect -- --resume               # skip already-processed URLs
pnpm detect -- --errors-only          # re-scan only sites that errored last run
pnpm detect -- --forwarded-only       # re-scan only redirected domains
pnpm detect -- --timeout 15000        # per-site timeout in ms (default: 10000)
pnpm detect -- --source /path/to/yml  # use a different showcase directory
pnpm detect -- --output results.json  # write to a different output file
```

After running, clear the Astro cache to pick up new data:

```bash
rm -rf .astro && pnpm dev
```

### `pnpm crux` — Chrome UX Report

Fetches 28-day real-user field data (LCP, INP, CLS, FCP, TTFB) at origin level for all confirmed Astro sites from the latest scan. Tries the bare domain first; falls back to `www.` on 404. Rate-limited to ~120 req/min (safely under the 150/min quota). Estimated ~53 min for a full run.

Requires `CRUX_API_KEY` in `.env`.

```bash
pnpm crux                             # fetch all 3 form factors for every site
pnpm crux -- --form-factor=DESKTOP    # DESKTOP | PHONE | TABLET (default: all 3)
pnpm crux -- --new-only               # skip site × form_factor combos fetched today
pnpm crux -- --limit=100              # cap number of sites (testing)
pnpm crux -- --dry-run                # print what would be fetched, write nothing
```

### `pnpm psi` — PageSpeed Insights

Fetches Lighthouse scores (performance, accessibility, best-practices, SEO) plus lab and field metrics (LCP, CLS, INP, TBT) for both mobile and desktop strategies. Rate-limited to ~85 req/min. Estimated ~100 min for a full run (~2,100 sites × 2 strategies).

Requires `PAGESPEED_API_KEY` in `.env`.

```bash
pnpm psi                              # fetch both strategies for every site
pnpm psi -- --strategy=mobile        # mobile | desktop (default: both)
pnpm psi -- --new-only               # skip site × strategy combos already fetched
pnpm psi -- --limit=100              # cap number of sites (testing)
pnpm psi -- --dry-run                # print what would be fetched, write nothing
```

### `pnpm make-prs` — prepare showcase removal PR branches

Reads confirmed-gone domains from the latest `dns-check` run, matches each to its YAML file in `.showcase-cache`, batches them into groups of 50, and for each batch: creates a branch, deletes the YAMLs, appends to `blockedOrigins`, commits, and pushes to the fork. Saves a `pr-body-batch-N.md` file and prints the `gh pr create` command to submit manually.

```bash
pnpm make-prs                       # prepare branches for all gone domains (batches of 50)
pnpm make-prs -- --batch-size=25    # smaller batches
pnpm make-prs -- --batch=2          # only process batch 2
pnpm make-prs -- --dry-run          # print plan without touching git
```

### `pnpm dns-check` — triage error sites

Queries `.scan-history.db` for persistently-erroring sites then classifies each one via a DNS over HTTPS lookup (Cloudflare + Google) followed by an HTTP HEAD request:

| Result        | Meaning                                                               |
| :------------ | :-------------------------------------------------------------------- |
| `GONE`        | Both DoH resolvers return NXDOMAIN — domain likely expired or deleted |
| `ALIVE`       | DNS resolves + HEAD returns 2xx/3xx — transient error at scan time    |
| `BROKEN`      | DNS resolves + HEAD returns 4xx/5xx — server up but site is broken    |
| `DEAD SERVER` | DNS resolves but connection refused or timed out                      |
| `DNS ERROR`   | DoH lookup itself failed (network issue)                              |

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
pnpm db:report -- --site example.com  # full scan history for one hostname
pnpm db:report -- --all               # run every report
```

## Project structure

```
├── .showcase-cache/            # Sparse clone of withastro/astro.build (gitignored)
├── scripts/
│   └── detect-cms.ts           # Detection script (run with pnpm detect)
├── src/
│   ├── components/
│   │   └── showcase/
│   │       ├── ShowcaseTable.astro       # Results table
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
│   │   └── about.astro         # About page
│   └── types/
│       └── index.ts            # Shared TypeScript types
```

## Tech stack

- [Astro 6](https://astro.build)
- [Chart.js 4](https://www.chartjs.org) for insights charts
- [Biome](https://biomejs.dev) for linting and formatting
- [Turso](https://turso.tech) for analytics storage (via Pandalytics)
- Deployed on [Netlify](https://www.netlify.com)
