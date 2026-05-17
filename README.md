# Astro 6 Starter

A clean, modern Astro 6 starter with semantic component organization, modern CSS with `@layer` support, and Biome for code quality.

## Features

- **Astro 6** - Latest version with experimental features enabled
- **Modern CSS** - No Sass, uses native CSS with `@layer` for cascade management
- **Semantic Components** - Organized by purpose (global, schema, feature-specific)
- **Biome** - Fast linting and formatting with zero-config setup
- **JSON-LD Schema** - Built-in WebSite schema with SearchAction
- **Path Aliases** - Clean imports with `@components`, `@layouts`, `@types`, etc.
- **CUBE CSS** - Composition utilities (flow, grid, wrapper)

## 🚀 Project Structure

```text
/
├── public/
├── src/
│   ├── assets/           # Images and static assets
│   ├── components/
│   │   ├── global/       # Layout components (Header, Footer, etc.)
│   │   └── schema/       # JSON-LD schema components
│   ├── config/           # Configuration files (siteMetadata.ts)
│   ├── layouts/          # Page layouts
│   ├── pages/            # Routes
│   ├── scripts/          # Client-side scripts
│   ├── styles/           # Global and composition styles
│   │   └── compositions/ # CUBE CSS utilities
│   └── types/            # TypeScript definitions
└── package.json
```

## 🧞 Commands

| Command             | Action                                 |
| :------------------ | :------------------------------------- |
| `pnpm install`      | Install dependencies                   |
| `pnpm dev`          | Start dev server at `localhost:4321`   |
| `pnpm build`        | Build production site to `./dist/`     |
| `pnpm preview`      | Preview build locally before deploying |
| `pnpm biome check`  | Check code quality with Biome          |
| `pnpm biome format` | Format code with Oxfmt                 |

## ⚙️ Configuration

### JSON-LD Schema

Edit `src/config/siteMetadata.ts` to customize the WebSite JSON-LD schema:

```typescript
export const siteMetadata: SiteMetadata = {
	name: "My Site Name",
	description: "Site description for SEO",
	logo: "/logo.svg",
	contactEmail: "info@example.com",
	searchRoute: "/search", // Optional: enables SearchAction in schema
};
```

The schema is automatically injected into every page's `<head>` via the `WebsiteJsonLD` component.

## 📋 Notes

- See `CLAUDE.md` for development guidelines
- Never use `!important` in CSS — solve specificity with `@layer`
- Use path aliases for all imports
- Components should be used when imported (fix Biome warnings during implementation)
