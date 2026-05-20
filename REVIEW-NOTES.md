# Site Review Notes

Working notes for manual review of detection results. Add findings here as sites are checked.

---

## URL issues

The Astro showcase accepts any URL a submitter chooses — often a docs subdirectory, a blog, or a landing page rather than the root domain. This means the scanned URL may not represent the site's main Astro presence, and the detection result reflects only that specific page.

### Patterns to watch for

| Pattern | Example | Issue |
| :--- | :--- | :--- |
| Docs subdirectory submitted instead of root | `coolify.io/docs/` (VitePress) vs `coolify.io/` (Astro) | Root is Astro; docs are a separate tool |
| Blog subdirectory | `example.com/blog/` | Blog may be a headless CMS; main site is Astro |
| Subdomain submitted | `docs.example.com` | Different stack from main domain |
| Redirect to a third-party page | `example.com` → `app.example.com` | App is SaaS, not the marketing site |
| Site has migrated but docs remain | Legacy Starlight docs still live; main site rebuilt in Next.js | Looks like Astro when it's not |

### Confirmed URL mismatches

| Showcase URL (scanned) | Actual root | Notes |
| :--- | :--- | :--- |
| `https://coolify.io/docs/` | `https://coolify.io/` | Docs are VitePress; homepage is Astro with Svelte islands |

---

## False positives / false negatives to investigate

Sites where the detection result looks wrong and needs a manual check.

| Site | Scanned URL | Detected as | Likely actually | Notes |
| :--- | :--- | :--- | :--- | :--- |
| — | — | — | — | — |

---

## Detector improvements found during review

| Issue | Fix | Status |
| :--- | :--- | :--- |
| `\bsveltekit\b` matched marketing copy | Removed bare word; keep `__sveltekit_`, `data-sveltekit-`, `svelte-announcer` only | ✅ Fixed 2026-05-20 |
| VitePress not detected | Added generator meta tag match | ✅ Fixed 2026-05-20 |
