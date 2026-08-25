## Summary

This site's domain now serves WordPress-generated Vietnamese gambling/card-game content ("SAOWIN" branded), not the original site. No HTTP redirect occurs — same origin, 200 response — so this wasn't caught by cross-host redirect detection. Confirmed via direct fetch: page is served by WordPress (wp-content/wp-json paths, Rank Math SEO plugin markers), title/meta are Vietnamese gambling copy, and zero Astro signals (no generator meta, no data-astro-* attributes, no /_astro/ asset paths, no <astro-island> elements) are present anywhere in the response.

All removed domains added to `blockedOrigins` to prevent the weekly CI from re-adding them.

| Site | isAstro |
| :--- | :--- |
| [AI Daily News \| Your Source for the Latest AI News](https://aidailynews.io/) | [verify ↗](https://isastro.pages.dev/?url=aidailynews.io) |