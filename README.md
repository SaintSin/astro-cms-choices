# Astro Showcase — CMS Detector

**Live site: [astro-what-cms.netlify.app](https://astro-what-cms.netlify.app)**

Scans every site in the [Astro showcase](https://astro.build/showcase/) and fingerprints which CMS (if any) is powering it — headless CMSs, page builders, full-site platforms, JS frameworks, and static-site generators.

## What it does

- Fetches all ~2,600 sites listed in the Astro showcase
- Fingerprints each site from HTML and HTTP headers
- Detects whether the site is still running on Astro
- Displays results in a filterable, sortable, paginated table
- [Insights page](/insights) with version distribution and submission trend charts

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

| Command                          | Action                                                        |
| :------------------------------- | :------------------------------------------------------------ |
| `pnpm dev`                       | Start dev server at `localhost:4321`                          |
| `pnpm detect`                    | Scan all showcase sites and write `src/data/cms-results.json` |
| `pnpm detect -- --limit 50`      | Scan first 50 sites only                                      |
| `pnpm detect -- --resume`        | Skip already-processed URLs                                   |
| `pnpm detect -- --concurrency 8` | Set fetch concurrency (default: 6)                            |
| `pnpm build`                     | Build production site                                         |
| `pnpm check`                     | Lint and format with Biome                                    |

`pnpm detect` manages the showcase data automatically:

- **First run** — clones `withastro/astro.build` as a sparse checkout into `.showcase-cache/` (`.yml` files only, no screenshots)
- **Subsequent runs** — pulls the latest changes before scanning

After running `pnpm detect`, clear the Astro cache and restart the dev server to pick up new data:

```bash
rm -rf .astro && pnpm dev
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
