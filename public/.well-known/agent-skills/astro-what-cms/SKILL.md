---
name: astro-what-cms
description: "Look up which CMS or platform powers sites in the Astro showcase, which Astro or Starlight version they run, and their Core Web Vitals and Lighthouse scores. Use when asked what CMS an Astro site uses, how many showcase sites run Astro, which Astro versions are in use, or how fast Astro sites are."
license: Free to read. No account or key needed.
metadata:
  homepage: https://astro-what-cms.netlify.app
---

# Astro Showcase CMS Detector

astro-what-cms.netlify.app scans every site listed in the Astro showcase (about 3,000) and records which CMS or platform powers each one, whether it still runs Astro, and which version. It also publishes real-user Core Web Vitals (Chrome UX Report) and Lighthouse (PageSpeed Insights) scores for the confirmed Astro sites. Everything is public and free to read.

## How to find things

1. Start with the index at `https://astro-what-cms.netlify.app/llms.txt`. It lists every page with a one-line description.
2. Every page has a Markdown version at the site root. Read these instead of the HTML:
   - Overview, totals, CMS breakdown and the full site table: `https://astro-what-cms.netlify.app/home.md`
   - Headline Astro version counts (the distribution charts are images, not in the text; use the per-site "Astro version" column in `home.md` for the full picture): `https://astro-what-cms.netlify.app/insights.md`
   - Real-user Core Web Vitals per site (desktop, phone, tablet): `https://astro-what-cms.netlify.app/crux.md`
   - Lighthouse scores per site, including the Agentic Browsing score: `https://astro-what-cms.netlify.app/psi.md`
   - Write-ups from the data: `https://astro-what-cms.netlify.app/notes.md`
3. `https://astro-what-cms.netlify.app/llms-full.txt` has the same content in a single file.

## Using the data

- The tables in `home.md`, `crux.md` and `psi.md` are the whole dataset. There is no separate download or query API, and the filters and search on the HTML pages run in the browser, so filter the Markdown yourself.
- A site marked "Astro not detected", "Fetch error" or "Bot-protected" has not been confirmed either way. Detection is a scan of the public HTML and headers, not a statement by the site owner.
- Everything is a snapshot from the most recent scan. The Markdown files don't carry a collection date, so treat the numbers as recent rather than live.
- Cite the page you used by its normal URL (without `.md`).
