## Summary

Removes 50 showcase sites whose domains are confirmed gone (NXDOMAIN on both Cloudflare and Google DNS over HTTPS). Batch 3 of 3.

All domains verified using `pnpm dns-check` ([source](https://github.com/SaintSin/astro-cms-choices/blob/main/scripts/dns-check.mjs)) — queries the scan history database for persistently-erroring sites, then cross-checks each domain against two independent DNS over HTTPS resolvers (Cloudflare + Google). Only domains where both resolvers return NXDOMAIN are flagged as gone.

Every domain across this removal has failed at least 24 consecutive scans (the "Consecutive failed scans" column below); 138 of 150 have been failing continuously for 100+ scans, dating back over 3 months.

All removed domains added to `blockedOrigins` to prevent the weekly CI from re-checking them.

| Site | Consecutive failed scans | isAstro |
| :--- | ---: | :--- |
| [The Daily Stoic](https://thedailystoic.art) | 148 | [verify ↗](https://isastro.pages.dev/?url=thedailystoic.art) |
| [TCET - Training and Placement Cell](https://tnp.tcetmumbai.in/) | 148 | [verify ↗](https://isastro.pages.dev/?url=tnp.tcetmumbai.in) |
| [Tonari - AI Habit Coach](https://tonari.io/) | 44 | [verify ↗](https://isastro.pages.dev/?url=tonari.io) |
| [Top 3 NFT Marketplaces](https://top3nftmarketplaces.org/) | 148 | [verify ↗](https://isastro.pages.dev/?url=top3nftmarketplaces.org) |
| [General Contractor Toronto & Across GTA \| Renovation & Masonry Services \| Commercial General Contractors](https://trtcontracting.ca/) | 148 | [verify ↗](https://isastro.pages.dev/?url=trtcontracting.ca) |
| [Type The Alphabet](https://typethealphabet.online/) | 148 | [verify ↗](https://isastro.pages.dev/?url=typethealphabet.online) |
| [Ukuvota - Home](https://ukuvota.world/) | 148 | [verify ↗](https://isastro.pages.dev/?url=ukuvota.world) |
| [MossAway \| Roof Moss Treatment, Window & Gutter Cleaning in Victoria, BC](https://victoria.mossaway.ca) | 148 | [verify ↗](https://isastro.pages.dev/?url=victoria.mossaway.ca) |
| [Stable Video Diffusion\U0001F525\| SVD \| Open Source & Free AI Video Generator](https://video-stable-diffusion.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=video-stable-diffusion.com) |
| [WaveMind — Hung Nguyen portfolio](https://whoiam.id.vn/en) | 148 | [verify ↗](https://isastro.pages.dev/?url=whoiam.id.vn) |
| [DeCodX \| Web Developer and UI/UX Designer](https://wildecodx.me/) | 148 | [verify ↗](https://isastro.pages.dev/?url=wildecodx.me) |
| [Wind Basics](https://windbasics.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=windbasics.com) |
| [31SaaS - A Boilterplate to Build Sleek and Modern SaaS](https://www.31saas.com/) | 58 | [verify ↗](https://isastro.pages.dev/?url=www.31saas.com) |
| [911 Dispatcher Cheat Sheet](https://www.911dcs.net/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.911dcs.net) |
| [Aksiomatik \|\| Jasa Olah Data Statistik](https://www.aksiomatik.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.aksiomatik.com) |
| [Votre carte de restaurant digitale \| AlloResto](https://www.alloresto.app/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.alloresto.app) |
| [Articoli e Social](https://www.articoliesocial.it/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.articoliesocial.it) |
| [Transform Your Umbraco CMS with a Dynamic Dashboard \| Astroboard](https://www.astroboard.website/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.astroboard.website) |
| [Home - Anacle Technical Day 2023](https://www.atd2023.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.atd2023.com) |
| [BeanBuddies \| Dein Unterstuetzer fuer schwierige Zeiten](https://www.beanbuddies.app) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.beanbuddies.app) |
| [ByteShip](https://www.byteship.dev/astro-strapi) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.byteship.dev) |
| [Carvimage](https://www.carvimage.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.carvimage.com) |
| [Cox Code \| Premier Digital Agency in Adelaide - Web & App Development in Australia](https://www.coxcode.io) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.coxcode.io) |
| [Creative Software - Logo - Design - Web \| creativepages.xyz](https://www.creativepages.xyz/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.creativepages.xyz) |
| [CrossSphere \| Spices.Export.Worldwide.](https://www.crosssphereexim.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.crosssphereexim.com) |
| [Aktuelle Deals und Angebote für Camper \U0001F3D5️](https://www.dealpicks.de/camping/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.dealpicks.de) |
| [Digitzen](https://www.digitzen.co/) | 44 | [verify ↗](https://isastro.pages.dev/?url=www.digitzen.co) |
| [Maria Antonelli, dog sitter Treviglio - Dog sitter Treviglio](https://www.dogsittertreviglio.it) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.dogsittertreviglio.it) |
| [Donate2Motivate](http://www.donate2motivate.co.uk) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.donate2motivate.co.uk) |
| [Fanindra Maharana - Work](https://www.fanindra.xyz/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.fanindra.xyz) |
| [heliumpng.tech](https://www.heliumpng.tech/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.heliumpng.tech) |
| [\U0001F308 HerIsDia's website](https://www.herisdia.me/) | 42 | [verify ↗](https://isastro.pages.dev/?url=www.herisdia.me) |
| [Portfolio de Jeyson Guzman - Desarrollador Frontend y programador Web con](https://www.jeysonguzman.online/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.jeysonguzman.online) |
| [LoopTube - Transform Any YouTube Video Into Perfect Loops](https://www.looptube.cc) | 42 | [verify ↗](https://isastro.pages.dev/?url=www.looptube.cc) |
| [L'annuaire des médecins en Algérie](https://www.medecinsalgerie.org) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.medecinsalgerie.org) |
| [The Conversion Focused Web Design Agency](https://www.minov.studio/) | 42 | [verify ↗](https://isastro.pages.dev/?url=www.minov.studio) |
| [Nano Fighters Club en Marbella](https://www.nanofighters.club/es/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.nanofighters.club) |
| [NotionPaper - A tool that helps you use Notion like a CMS](https://www.notionpaper.cc/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.notionpaper.cc) |
| [Improve Your Online Presence with Professional Profile Content](https://www.profiletherapy.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.profiletherapy.com) |
| [R. Ilham Sastronegoro](https://www.radenpioneer.work/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.radenpioneer.work) |
| [Realm \| Landing](https://www.realmof.tech/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.realmof.tech) |
| [Minecraft Admin Wiki](https://www.setup.md/) | 120 | [verify ↗](https://isastro.pages.dev/?url=www.setup.md) |
| [Spasić Snežana Autotrasporti](https://www.snezanaspasicautotrasporti.it/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.snezanaspasicautotrasporti.it) |
| [Úvod \| Společná focení](https://www.spolecnafoceni.cz/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.spolecnafoceni.cz) |
| [Supadev – Development done right](https://www.supadev.io) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.supadev.io) |
| [Tarik Rital \| Personal Portfolio Website Template](https://www.tarikrital.website/) | 137 | [verify ↗](https://isastro.pages.dev/?url=www.tarikrital.website) |
| [UNION VISION ALLIANCE - Get the most out of their vision benefits](https://www.unionvisionalliance.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.unionvisionalliance.com) |
| [VigorBond - Empowering Communities Through Sustainable Development](https://www.vigorbond.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=www.vigorbond.com) |
| [yuxxeun.](https://yuxxeun.tech) | 148 | [verify ↗](https://isastro.pages.dev/?url=yuxxeun.tech) |
| [rescaler](https://zkrew.red/rescaler/) | 148 | [verify ↗](https://isastro.pages.dev/?url=zkrew.red) |