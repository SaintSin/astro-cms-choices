# Changelog

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
