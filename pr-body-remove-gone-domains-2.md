## Summary

Removes 50 showcase sites whose domains are confirmed gone (NXDOMAIN on both Cloudflare and Google DNS over HTTPS). Batch 2 of 3.

All domains verified using `pnpm dns-check` ([source](https://github.com/SaintSin/astro-cms-choices/blob/main/scripts/dns-check.mjs)) — queries the scan history database for persistently-erroring sites, then cross-checks each domain against two independent DNS over HTTPS resolvers (Cloudflare + Google). Only domains where both resolvers return NXDOMAIN are flagged as gone.

Every domain across this removal has failed at least 24 consecutive scans (the "Consecutive failed scans" column below); 138 of 150 have been failing continuously for 100+ scans, dating back over 3 months.

All removed domains added to `blockedOrigins` to prevent the weekly CI from re-checking them.

| Site | Consecutive failed scans | isAstro |
| :--- | ---: | :--- |
| [Keyboard Counter](https://keyboardcounter.online/) | 148 | [verify ↗](https://isastro.pages.dev/?url=keyboardcounter.online) |
| [\U0001F4B0 Подбор кредитов онлайн \| низкие ставки \| сравни варианты](https://kreditguide.ru) | 148 | [verify ↗](https://isastro.pages.dev/?url=kreditguide.ru) |
| [Jesswin W Varghese \| Lemokami](https://lemokami.dev) | 148 | [verify ↗](https://isastro.pages.dev/?url=lemokami.dev) |
| [Leosvel](https://leosvel.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=leosvel.dev) |
| [lin \| lin](https://lin.yuo.app/) | 148 | [verify ↗](https://isastro.pages.dev/?url=lin.yuo.app) |
| [TCET Linux](https://linux.tcetmumbai.in/) | 148 | [verify ↗](https://isastro.pages.dev/?url=linux.tcetmumbai.in) |
| [L(o*62).ong](https://loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo.ong/) | 148 | [verify ↗](https://isastro.pages.dev/?url=loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo.ong) |
| [Black M1D1™](https://m1d1.black) | 148 | [verify ↗](https://isastro.pages.dev/?url=m1d1.black) |
| [武蔵野美術大学電子音楽研究会](https://mauems.com/) | 55 | [verify ↗](https://isastro.pages.dev/?url=mauems.com) |
| [Mauv](https://mauv.page/) | 148 | [verify ↗](https://isastro.pages.dev/?url=mauv.page) |
| [Máy Tinh Online](https://maytinhonline.one/) | 148 | [verify ↗](https://isastro.pages.dev/?url=maytinhonline.one) |
| [Dolphie \| Discover high-quality, affordable learning resources from awesome indie educators](https://meetdolphie.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=meetdolphie.com) |
| [Mi casa de apuesta \| Descubre las mejores casas de apuestas](https://micasadeapuesta.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=micasadeapuesta.com) |
| [Microattestations - ICÉA](https://microattestations.ca/) | 148 | [verify ↗](https://isastro.pages.dev/?url=microattestations.ca) |
| [Introduction - mly.fyi](https://mly.fyi) | 148 | [verify ↗](https://isastro.pages.dev/?url=mly.fyi) |
| [Mocked-API](https://mocked-api.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=mocked-api.dev) |
| [MONOMOD](https://monomod.studio/) | 148 | [verify ↗](https://isastro.pages.dev/?url=monomod.studio) |
| [Muj – Frontend Engineer, UI/UX Designer, Design Systems Engineer](https://mujs.dev/) | 111 | [verify ↗](https://isastro.pages.dev/?url=mujs.dev) |
| [記事一覧｜マイプログラミング](https://myprg.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=myprg.dev) |
| [No More Noise](https://nomorenoisegame.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=nomorenoisegame.com) |
| [Offering Inspiration - A non-biased gift idea site](https://offeringinspiration.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=offeringinspiration.com) |
| [opensrcai.com](https://opensrcai.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=opensrcai.com) |
| [OPN: Your Open-Source Bio Page](https://opn.bio) | 95 | [verify ↗](https://isastro.pages.dev/?url=opn.bio) |
| [Perseotech \| Inovação Digital ao seu Alcance](https://perseotech.com.br/) | 148 | [verify ↗](https://isastro.pages.dev/?url=perseotech.com.br) |
| [Pizza Billionaire](https://pizzabillionaire.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=pizzabillionaire.com) |
| [Pixels Perfect Design](https://ppd.realikea.co.uk/) | 148 | [verify ↗](https://isastro.pages.dev/?url=ppd.realikea.co.uk) |
| [Tailus - templates preview](https://preview.tailus.io/) | 148 | [verify ↗](https://isastro.pages.dev/?url=preview.tailus.io) |
| [Your Path To Full Stack Python \| The Pyoneer Project](https://pyoneers.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=pyoneers.dev) |
| [pyros.sh](https://pyros.sh/) | 148 | [verify ↗](https://isastro.pages.dev/?url=pyros.sh) |
| [RawenCat - Star](https://rawen.cat) | 148 | [verify ↗](https://isastro.pages.dev/?url=rawen.cat) |
| [Roseto — Growing is a necessity, not an option.](https://roseto.co) | 148 | [verify ↗](https://isastro.pages.dev/?url=roseto.co) |
| [RyzeKit Astro](https://ryzekit.com/astro) | 148 | [verify ↗](https://isastro.pages.dev/?url=ryzekit.com) |
| [s0 - Sosial Media Diredefinisi](https://s0.dnn.web.id) | 105 | [verify ↗](https://isastro.pages.dev/?url=s0.dnn.web.id) |
| [Home \| These are the Sayings of Kabolobari](https://sayings.cc) | 148 | [verify ↗](https://isastro.pages.dev/?url=sayings.cc) |
| [sebdanielsson.dev](https://sebbo.io) | 148 | [verify ↗](https://isastro.pages.dev/?url=sebbo.io) |
| [Sentral Bisnis Digital — Semangat Transformasi Digital](https://sentralbisnisdigital.co.id) | 148 | [verify ↗](https://isastro.pages.dev/?url=sentralbisnisdigital.co.id) |
| [Home • Computer Science blog](https://sergiorios.lat/) | 148 | [verify ↗](https://isastro.pages.dev/?url=sergiorios.lat) |
| [Serhat Düzgün — Designer](https://serhatduzgun.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=serhatduzgun.com) |
| [Simloud \| Your all-in-one deployments cost savings platform](https://simloud.com) | 148 | [verify ↗](https://isastro.pages.dev/?url=simloud.com) |
| [The Sloths Of DALL·E](https://slothsofdalle.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=slothsofdalle.com) |
| [SmartGamer - Find the Best Gaming Deals](https://smartgamer.in) | 142 | [verify ↗](https://isastro.pages.dev/?url=smartgamer.in) |
| [Sofia Zaitseva](https://sofia.swingsanddesigns.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=sofia.swingsanddesigns.com) |
| [Rafid Muhymin Wafi](https://softhardsystem.com/) | 142 | [verify ↗](https://isastro.pages.dev/?url=softhardsystem.com) |
| [Starlight Contributor List](https://starlight-contributor-list.trueberryless.org/) | 148 | [verify ↗](https://isastro.pages.dev/?url=starlight-contributor-list.trueberryless.org) |
| [The #1 SaaS Boilerplate Collection](https://startupguns.com/) | 148 | [verify ↗](https://isastro.pages.dev/?url=startupguns.com) |
| [Sukhpreet Singh \| Front-end Engineer](https://sukhpreet.dev) | 148 | [verify ↗](https://isastro.pages.dev/?url=sukhpreet.dev) |
| [Free Online Tools & Utilities \| Super Tools](https://super-tools.org) | 42 | [verify ↗](https://isastro.pages.dev/?url=super-tools.org) |
| [SuperCalc - Calculate at the Speed of Light](https://supercalc.online/) | 148 | [verify ↗](https://isastro.pages.dev/?url=supercalc.online) |
| [TakoBits.dev](https://takobits.dev/) | 148 | [verify ↗](https://isastro.pages.dev/?url=takobits.dev) |
| [Разная информация о татарском движении • tatars.kz](https://tatars.kz/) | 148 | [verify ↗](https://isastro.pages.dev/?url=tatars.kz) |