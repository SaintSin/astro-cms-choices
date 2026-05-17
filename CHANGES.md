# Changelog

All notable changes to the AstroInitial starter template are documented here, organized by date.

## 2026

### April 9

- **Swap `<Image>` for `<Picture>` in index.astro** — All image instances now use `<Picture>` with `formats={["avif", "webp"]}` for modern format output
- **Add `ariaLabel` prop to Link component** — Optional `aria-label` support added to `Link.astro` for icon-only links and improved accessibility

### March 20

- **Replace open-props spacing with Utopia tokens** — Migrated `--size-fluid-*` variables to Utopia.fyi `--space-*` tokens in Header and Footer components
- **Update CLAUDE.md with Git guidelines** — Added Git & GitHub section with instructions to never commit unless instructed and never use Claude as a contributor
- **Add .npmrc sharp configuration** — Configured npm to use system-installed libvips for Sharp image optimization

### March 18

- **Add JSON LD schema for site navigation and breadcrumbs**
  - Added `BreadcrumbJsonLD.astro` component for breadcrumb navigation schema
  - Added `SiteNavigationJsonLD.astro` component for site navigation schema
  - Created `breadcrumbHelper.ts` utility for breadcrumb generation
  - Updated `siteMetadata` config to include optional menu navigation items

### March 12

- **Move /public** — Reorganized public assets directory structure
- **Add Sharp** — Added Sharp image optimization dependency

### March 11

- **Complete refresh with Astro 6** — Major upgrade to Astro 6.0

### February 28

- **WebsiteJsonLD** — Added WebsiteJsonLD component for enhanced search results

### February 27

- **Prep for Astro 6** — Migration preparation and configuration updates for Astro 6

### February 23

- **Polish** — General code and layout refinements

### February 15

- **Header Fix** — Fixed header component styling and layout

### January 24

- **Remove prettier. Rename gloabls.scss to tokens.scss** — Removed Prettier (using Biome instead), renamed SCSS tokens file

### January 7

- **Add .npmrc file** — Added npm configuration file
- **Sharp binary config** — Sharp image optimization binary configuration

## 2025

- **Remove unused image, and optimisation of used image** — Cleaned up images and optimized remaining assets

### June 14

- **Add Twitter metadata** — Added Twitter Card meta tags for social sharing

### June 7

- **Remove og:logo** — Removed Open Graph logo meta tag

### May 7

- **Set permitted builds** — Configured build permissions
- **Initial Commit** — Initial repository setup

### Initial

- **Initial commit from Astro** — Project bootstrapped from Astro starter template
