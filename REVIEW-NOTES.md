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

## PR submission process

PRs go to [withastro/astro.build](https://github.com/withastro/astro.build). The showcase source files live in `src/content/showcase/` — one `.yml` + one `.webp` per site.

### Removing sites (no longer Astro)

1. Delete the `.yml` and `.webp` files for each site
2. **Add the removed URLs to `blockedOrigins`** in `scripts/update-showcase.mjs` — this stops the weekly CI job from re-checking them and potentially re-adding them. Use the root domain (e.g. `https://coolify.io/` not `https://coolify.io/docs/`). Add a dated comment: `// 2026-05-25 - no longer Astro`
3. Check open issues — if a site owner has already filed a removal request, note `closes #NNNN` in the commit message so it auto-closes
4. Keep PRs to manageable batches (~10 sites) so maintainers can review quickly
5. Only include sites where a non-Astro framework/CMS was **positively identified** — don't include sites that are merely undetectable or erroring

### Review process (what maintainers check)

- **trueberryless** (contributor) cross-checks sites via [isastro.pages.dev](https://isastro.pages.dev) and manual HTML inspection
- **sarah11918** (member) does a final pass before approving — she's thorough, be patient
- **delucis** (member) reviews code/config changes — he's the one who will catch anything in `update-showcase.mjs`
- Community members can help verify sites in PR comments — encourage them to claim a range (e.g. "A–F done, no Astro found") to avoid duplicate effort
- The astro-what-cms isAstro hover link (`test ↗`) can be shared to speed up community verification

### Key feedback from delucis (PR #2409)

- Always add removed domains to `blockedOrigins` in `update-showcase.mjs`
- If a removal PR also fixes an open issue, reference it with `closes #NNNN` in the commit message
- The Netlify deploy preview needs a maintainer to approve it — this is separate from the code review approval and can block merge even after approval

### Merge sequence

1. Submit PR with removals + `blockedOrigins` additions
2. Community spot-checks sites in comments
3. Contributor approval (trueberryless or similar) — speeds things up but not sufficient alone
4. Member approval (sarah11918, delucis, or other core team) — required to unblock merge
5. Netlify deploy preview approved by maintainer
6. Merge

---

## Detector improvements found during review

| Issue | Fix | Status |
| :--- | :--- | :--- |
| `\bsveltekit\b` matched marketing copy | Removed bare word; keep `__sveltekit_`, `data-sveltekit-`, `svelte-announcer` only | ✅ Fixed 2026-05-20 |
| VitePress not detected | Added generator meta tag match | ✅ Fixed 2026-05-20 |
