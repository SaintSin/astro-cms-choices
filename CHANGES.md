# Changelog

## 2026-05-17

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

### UI

- Stats cards: total scanned, Astro confirmed, Astro not detected, sites with CMS detected, fetch errors
- Breakdown bar chart showing all identified CMSs (Unknown/Error/Blocked excluded)
- Clickable bar chart rows filter the results table
- Toolbar quick-filters: Starlight, JS Frameworks (filters all `framework` type), Astro not detected
- Search by site title or URL
- CMS type badges colour-coded by category (blue = headless, purple = page builder, red = full-site, cyan = framework, green = static gen)
- Orange row highlight for `full-site` rows (sites no longer running Astro)
- "Sites with CMS detected" stat label (was "CMS identified" — ambiguous)
- Removed Categories column from results table
