## Summary

Removes 50 showcase sites whose domains are confirmed gone (NXDOMAIN on both Cloudflare and Google DNS over HTTPS). Batch 1 of 3.

All domains verified using `pnpm dns-check` ([source](https://github.com/SaintSin/astro-cms-choices/blob/main/scripts/dns-check.mjs)) — queries the scan history database for persistently-erroring sites, then cross-checks each domain against two independent DNS over HTTPS resolvers (Cloudflare + Google). Only domains where both resolvers return NXDOMAIN are flagged as gone.

Every domain across this removal has failed at least 24 consecutive scans (the "Consecutive failed scans" column below); 138 of 150 have been failing continuously for 100+ scans, dating back over 3 months.

All removed domains added to `blockedOrigins` to prevent the weekly CI from re-checking them.

| Site | Consecutive failed scans | isAstro |
| :--- | ---: | :--- |
| [Akshay Gore](https://akshaygore.tech/) | 32 | [verify ↗](https://isastro.pages.dev/?url=akshaygore.tech) |
| [Animer des ateliers UX](https://animerdesateliers.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=animerdesateliers.com) |
| [Anthony Gerardo Giuliano \| Web and cybersecurity expert](https://anthonygiuliano.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=anthonygiuliano.dev) |
| [Buy unique AI art canvas from just £25 \| AI ART GENERATOR](https://artgeneratorai.art/) | 148 | [verify ↗](https://isastro.pages.dev/?url=artgeneratorai.art) |
| [Arya Difa Hendrawan](https://aryadifa.com) | 106 | [verify ↗](https://isastro.pages.dev/?url=aryadifa.com) |
| [Hỏi nhanh](https://ask.foolishdev.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=ask.foolishdev.com) |
| [Party poll!](https://astro-polls.pages.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=astro-polls.pages.dev) |
| [Chhatresh Khatri \| Portfolio](https://astro-portfolio-aq4.pages.dev/) | 66 | [verify ↗](https://isastro.pages.dev/?url=astro-portfolio-aq4.pages.dev) |
| [Rishi Raj Jain](https://astro.rishi.app/) | 148 | [verify ↗](https://isastro.pages.dev/?url=astro.rishi.app) |
| [Transform Your Umbraco CMS with a Dynamic Dashboard \| Astroboard](https://astroboard.website) | 148 | [verify ↗](https://isastro.pages.dev/?url=astroboard.website) |
| [Astro Community Code::Stats Leaderboard](https://astrocoderstats.fun/) | 148 | [verify ↗](https://isastro.pages.dev/?url=astrocoderstats.fun) |
| [Astrolize - Starter Template for Astro with Tailwind CSS](https://astrolize.fabform.io/) | 148 | [verify ↗](https://isastro.pages.dev/?url=astrolize.fabform.io) |
| [Avik Banik](https://avikbanik.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=avikbanik.com) |
| [Ayanava Karmakar](https://ayanavakarmakar.software/) | 148 | [verify ↗](https://isastro.pages.dev/?url=ayanavakarmakar.software) |
| [BeesVPN - Protect your online safe \| Hawkpass](https://beesvpn.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=beesvpn.com) |
| [Be Radio Stereo](https://beradiostereo.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=beradiostereo.com) |
| [Welcome to Tech For Everyone](https://beta.learning.nicholasdwest.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=beta.learning.nicholasdwest.com) |
| [Demo - Tailus UI](https://beta.tailus.io/demo) | 148 | [verify ↗](https://isastro.pages.dev/?url=beta.tailus.io) |
| [Fanindra Maharana](https://blog.fanindra.xyz/) | 148 | [verify ↗](https://isastro.pages.dev/?url=blog.fanindra.xyz) |
| [ng.tr.anh.kiet](https://blog.nguyentruonganhkiet.work/) | 148 | [verify ↗](https://isastro.pages.dev/?url=blog.nguyentruonganhkiet.work) |
| [Personal Blog](https://blog.noorudd.in) | 148 | [verify ↗](https://isastro.pages.dev/?url=blog.noorudd.in) |
| [Bruno Alves](https://brunoalves.me/) | 148 | [verify ↗](https://isastro.pages.dev/?url=brunoalves.me) |
| [butterfree.org](https://butterfree.org/) | 138 | [verify ↗](https://isastro.pages.dev/?url=butterfree.org) |
| [¿Fan de laaaaaaaa Chaaampiooons? \| Heineken](https://championsheineken.co/) | 148 | [verify ↗](https://isastro.pages.dev/?url=championsheineken.co) |
| [Charles Wang](https://charl.sh) | 148 | [verify ↗](https://isastro.pages.dev/?url=charl.sh) |
| [Portfolio • Charles Cailleteau](https://charlescailleteau.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=charlescailleteau.com) |
| [color.xima — gradients that vibe](https://color.xima.work/en/) | 24 | [verify ↗](https://isastro.pages.dev/?url=color.xima.work) |
| [Conversion Refinery - Websites That Convert](https://conversionrefinery.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=conversionrefinery.com) |
| [Cool Energy Service San Vincenzo](https://coolenergyservice.it/) | 148 | [verify ↗](https://isastro.pages.dev/?url=coolenergyservice.it) |
| [Welcome to CorpoGrowth.](https://corpogrowth.gr/) | 148 | [verify ↗](https://isastro.pages.dev/?url=corpogrowth.gr) |
| [csusb.dev](https://csusb.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=csusb.dev) |
| [Julien Dendauw](https://dendauw.tech/) | 148 | [verify ↗](https://isastro.pages.dev/?url=dendauw.tech) |
| [DGANG - Dear God, Another Nix/NixOS Guide](https://dgang.bwc9876.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=dgang.bwc9876.dev) |
| [DisruptDesign - Expert Logo, Visual Identity, and Web Development Services](https://disrapt.co/) | 148 | [verify ↗](https://isastro.pages.dev/?url=disrapt.co) |
| [Welcome to Astro StudioCMS \| Astro StudioCMS](https://docs.astro-studiocms.xyz/) | 147 | [verify ↗](https://isastro.pages.dev/?url=docs.astro-studiocms.xyz) |
| [IW4x Documentation \| IW4x Docs](https://docs.iw4x.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=docs.iw4x.dev) |
| [Documentation \| Kuzu](https://docs.kuzudb.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=docs.kuzudb.com) |
| [Vitruvius - SPD Knowledge Base \| Vitruvius](https://docs.stoppopulationdecline.org) | 148 | [verify ↗](https://isastro.pages.dev/?url=docs.stoppopulationdecline.org) |
| [Me](https://elef.codes/) | 148 | [verify ↗](https://isastro.pages.dev/?url=elef.codes) |
| [exylons (Lance Ross)](https://exylons.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=exylons.com) |
| [Flaremingo](https://flaremingo.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=flaremingo.com) |
| [Git Folders](https://gitfolders.xyz/) | 148 | [verify ↗](https://isastro.pages.dev/?url=gitfolders.xyz) |
| [Health Connect Media](https://healthconnectmedia.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=healthconnectmedia.com) |
| [Indatech - Insan Muda Teknologi](https://indatech.my.id) | 148 | [verify ↗](https://isastro.pages.dev/?url=indatech.my.id) |
| [bem-vindo \| Yehoshua Oliveira \| ioxua.com](https://ioxua.com/br/) | 148 | [verify ↗](https://isastro.pages.dev/?url=ioxua.com) |
| [Javad Moradkhah](https://javadmoradkhah.ir) | 148 | [verify ↗](https://isastro.pages.dev/?url=javadmoradkhah.ir) |
| [About \| John Carlo Austria](https://jaycedotbin.me) | 148 | [verify ↗](https://isastro.pages.dev/?url=jaycedotbin.me) |
| [jorgson.tech](https://jorgson.tech/) | 148 | [verify ↗](https://isastro.pages.dev/?url=jorgson.tech) |
| [Josema Cruz \| Ingeniero de Telecomunicaciones y Desarrollador Web](https://josemacruz.dev) | 148 | [verify ↗](https://isastro.pages.dev/?url=josemacruz.dev) |
| [Kostur's Art](https://k0stur.art/) | 148 | [verify ↗](https://isastro.pages.dev/?url=k0stur.art) |