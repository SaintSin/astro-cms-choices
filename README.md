# Astro Showcase — CMS Detector

Scans every site in the [Astro showcase](https://astro.build/showcase/) and fingerprints which CMS (if any) is powering it — headless CMSs, page builders, full-site platforms, JS frameworks, and static-site generators.

## What it does

- Fetches all ~2,600 sites listed in the Astro showcase
- Fingerprints each site from HTML and HTTP headers
- Detects whether the site is still running on Astro
- Displays results in a filterable, searchable table

## Detection coverage

| Category | Examples |
| :--- | :--- |
| Headless CMS | Contentful, Sanity, Storyblok, Prismic, DatoCMS, Hygraph, Strapi, Keystatic, Builder.io, Tina CMS, Payload, Decap, and more |
| Page builder / hosted | Webflow, Squarespace, Wix, Framer, Shopify, HubSpot, Notion |
| Full-site CMS | WordPress, Ghost, Drupal, Joomla, Craft CMS, Kirby, Statamic, TYPO3, Umbraco |
| JS framework | Next.js, Nuxt, SvelteKit, Remix |
| Static-site generator | Starlight, Hugo, Eleventy, Jekyll, Gatsby, Hexo |

Astro detection uses five independent signals: generator meta tag, Starlight generator tag, `data-astro-cid-*` attributes, `/_astro/` asset paths, and `<astro-island>` elements.

Sites behind Cloudflare JS challenges are recorded as `Blocked` rather than `Unknown`.

## Commands

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Start dev server at `localhost:4321` |
| `pnpm detect` | Scan all showcase sites and write `src/data/cms-results.json` |
| `pnpm detect -- --limit 50` | Scan first 50 sites only |
| `pnpm detect -- --resume` | Skip already-processed URLs |
| `pnpm detect -- --concurrency 8` | Set fetch concurrency (default: 6) |
| `pnpm build` | Build production site |
| `pnpm check` | Lint and format with Biome |

After running `pnpm detect`, clear the Astro cache and restart the dev server to pick up new data:

```bash
rm -rf .astro && pnpm dev
```

## Project structure

```
├── scripts/
│   └── detect-cms.ts       # Detection script (run with pnpm detect)
├── src/
│   ├── data/
│   │   └── cms-results.json  # Generated output (gitignored if large)
│   └── pages/
│       └── index.astro       # Results UI
```

## Tech stack

- [Astro 6](https://astro.build)
- [Biome](https://biomejs.dev) for linting and formatting
