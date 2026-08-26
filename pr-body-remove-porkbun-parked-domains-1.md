## Summary

Both domains have lapsed and are now Porkbun marketplace "for sale" listing pages rather than the original sites. Confirmed via direct fetch: both titles read "Porkbun Marketplace: The domain <hostname> is for sale." and the page body references Porkbun repeatedly. No Astro signals present. (`aidailynews.io`-style domain reassignment noted in the last PR was a hijack to gambling content; this is the more common case — the domain simply expired and was picked up by the registrar's marketplace.)

All removed domains added to `blockedOrigins` to prevent the weekly CI from re-adding them.

| Site                                                                                    | isAstro                                                     |
| :-------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| [AIgentic — Agentic Systems & LLM Tooling Daily](https://aigentic.blog/)                | [verify ↗](https://isastro.pages.dev/?url=aigentic.blog)    |
| [Astro themes for portfolios and brands \| Astromade Studio](https://astromade.studio/) | [verify ↗](https://isastro.pages.dev/?url=astromade.studio) |
