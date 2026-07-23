// scripts/detect-cms.ts
// 2026-05-17T00:00:00Z
//
// Reads Astro showcase YAMLs, fetches each site, fingerprints the CMS, and
// writes src/data/cms-results.json.
//
// Usage:
//   pnpm detect
//   pnpm detect -- --source /path/to/astro.build/src/content/showcase
//   pnpm detect -- --limit 50 --concurrency 8
//   pnpm detect -- --resume          (skip already-processed URLs)

import { execSync } from "node:child_process";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { writeScanToDb } from "./db-utils.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Confidence = "high" | "medium" | "low";
// "full-site"  = a CMS/platform is rendering the whole page; Astro likely not involved.
// "headless-cms" = CMS provides content only; Astro (or similar) is the frontend.
// "framework"  = a JS framework (Next.js, Nuxt, SvelteKit) is rendering the page.
type CmsType =
	| "headless-cms"
	| "page-builder"
	| "full-site"
	| "framework"
	| "static-gen"
	| "parked"
	| "unknown";

interface ShowcaseEntry {
	title: string;
	url: string;
	categories?: string[];
	dateAdded: string;
}

export interface CmsResult {
	title: string;
	url: string;
	cms: string;
	cmsType: CmsType;
	confidence: Confidence | null;
	evidence: string[];
	astroDetected: boolean;
	astroVersion: string | null;
	starlightVersion: string | null;
	astroSignals: string[];
	framework: string | null;
	finalUrl: string | null;
	categories: string[];
	dateAdded: string;
	fetchedAt: string;
	error?: string;
}

export interface ResultsFile {
	generated: string;
	sourceDir: string;
	total: number;
	results: CmsResult[];
}

// ---------------------------------------------------------------------------
// YAML parser (handles the simple showcase format without a full YAML lib)
// ---------------------------------------------------------------------------

// fallow-ignore-next-line complexity
function parseShowcaseYaml(content: string): ShowcaseEntry | null {
	const result: Record<string, unknown> = {};
	const lines = content.split("\n");
	let inCategories = false;
	let foldedKey: string | null = null;
	const foldedLines: string[] = [];
	const categories: string[] = [];

	const flushFolded = () => {
		if (foldedKey) {
			result[foldedKey] = foldedLines.join(" ").trim();
			foldedKey = null;
			foldedLines.length = 0;
		}
	};

	for (const line of lines) {
		// Collecting a folded block scalar (title: >-)
		if (foldedKey !== null) {
			if (line.startsWith("  ") || line.startsWith("\t")) {
				foldedLines.push(line.trim());
				continue;
			}
			flushFolded();
		}

		if (inCategories) {
			const item = line.match(/^\s{2}-\s+(.+)$/);
			if (item) {
				categories.push(item[1].trim());
				continue;
			}
			inCategories = false;
		}

		if (line.startsWith("categories:")) {
			inCategories = true;
			continue;
		}

		const kv = line.match(/^([\w-]+):\s*(.*)$/);
		if (!kv) continue;
		const [, key, raw] = kv;
		const value = raw.trim();

		if (value === ">-" || value === ">" || value === "|" || value === "|-") {
			// Start collecting a block scalar
			foldedKey = key;
			continue;
		}

		result[key] = value.replace(/^['"]|['"]$/g, "").trim();
	}
	flushFolded();

	const url = result["url"] as string;
	if (!url || !url.startsWith("http")) return null;

	return {
		title: (result["title"] as string) || "",
		url,
		categories: categories.length ? categories : undefined,
		dateAdded: (result["dateAdded"] as string) || "",
	};
}

// ---------------------------------------------------------------------------
// CMS fingerprint rules
// ---------------------------------------------------------------------------

function makeParkedDetector(
	cms: string,
	htmlPattern: RegExp,
	hostnamePattern: RegExp,
): Rule {
	return {
		cms,
		cmsType: "parked",
		confidence: "high",
		match: (_html, _h, _u, finalUrl) =>
			htmlPattern.test(_html) ||
			(!!finalUrl && hostnamePattern.test(new URL(finalUrl).hostname)),
	};
}

interface Rule {
	cms: string;
	cmsType: CmsType;
	confidence: Confidence;
	match: (
		html: string,
		headers: Record<string, string>,
		url: string,
		finalUrl?: string,
	) => boolean;
}

const RULES: Rule[] = [
	// ── Headless CMSs ──────────────────────────────────────────────────────
	{
		cms: "Contentful",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /ctfassets\.net/i.test(html),
	},
	{
		cms: "Sanity",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /cdn\.sanity\.io/i.test(html),
	},
	{
		cms: "Storyblok",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /a\.storyblok\.com|storyblok-cdn\.com/i.test(html),
	},
	{
		cms: "Prismic",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /cdn\.prismic\.io|prismic\.io\/api/i.test(html),
	},
	{
		cms: "DatoCMS",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /datocms-assets\.com/i.test(html),
	},
	{
		cms: "Hygraph",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) =>
			/media\.graphassets\.com|eu-central-1-shared-euc1-02\.graphassets\.com|graphcms\.com\/assets/i.test(
				html,
			),
	},
	{
		cms: "Directus",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /\/directus\/assets\/|directus\.io\/assets\//i.test(html),
	},
	{
		cms: "Strapi",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /\/__strapi__|strapi-plugin|"strapi"\s*:\s*\{/i.test(html),
	},
	{
		cms: "Payload CMS",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /payload-cms|__PAYLOAD__|payloadcms\.com\/api/i.test(html),
	},
	{
		cms: "Builder.io",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) =>
			/cdn\.builder\.io|builder\.io\/api\/v\d|__builder_editing__|"@builder\.io\/sdk/i.test(
				html,
			),
	},
	{
		cms: "Kontent.ai",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) =>
			/assets-us-01\.kc-usercontent\.com|deliver\.kontent\.ai|preview-deliver\.kontent\.ai/i.test(
				html,
			),
	},
	{
		cms: "Cosmic",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /imgix\.cosmicjs\.com|cdn\.cosmicjs\.com/i.test(html),
	},
	{
		cms: "Crystallize",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) =>
			/media\.crystallize\.com|assets\.crystallize\.com/i.test(html),
	},
	{
		cms: "Tina CMS",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /\/__tina__|tinacms\.io\/cloud|cdn\.tina\.io/i.test(html),
	},
	{
		cms: "Decap CMS",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /decap-cms|netlify-cms/i.test(html),
	},
	{
		cms: "Keystatic",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) =>
			/\/keystatic\/|keystatic-app\.pages\.dev|"keystatic"\s*:/i.test(html),
	},
	{
		cms: "Caisy",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /caisy\.io\/v\d\/|assets\.caisy\.io/i.test(html),
	},

	// ── WordPress ──────────────────────────────────────────────────────────
	// Headless: WP provides content via REST/GraphQL but Astro renders the page.
	// wp-json in script src or data attributes = WP API being called client-side.
	{
		cms: "WordPress",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) =>
			/\/wp-json\/wp\/v2\//i.test(html) &&
			!/\/wp-content\/|\/wp-includes\//i.test(html),
	},
	// Full-site: WP is serving the page — Astro is not in the picture.
	// wp-content/uploads/ alone is NOT conclusive — headless setups serve WP media images too.
	// wp-content/themes/, wp-content/plugins/, and wp-includes/ are WP-rendered-page paths.
	{
		cms: "WordPress",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /WordPress/i),
	},
	{
		cms: "WordPress",
		cmsType: "full-site",
		confidence: "high",
		match: (html) =>
			/\/wp-content\/(?:themes|plugins)\/|\/wp-includes\//i.test(html),
	},
	// Headless: WP media assets referenced from an Astro frontend
	{
		cms: "WordPress",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html, _headers, url) => {
			// Only count wp-content/uploads on the same origin — external references
			// (e.g. partner logos in JSON-LD) are not a signal this site runs WP.
			const origin = new URL(url).origin;
			const sameOriginUpload = new RegExp(
				`(["'\`]|\\()(${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?/wp-content/uploads/`,
				"i",
			);
			return (
				sameOriginUpload.test(html) &&
				!/\/wp-content\/(?:themes|plugins)\/|\/wp-includes\//i.test(html)
			);
		},
	},

	// ── Other full-site CMSs ───────────────────────────────────────────────
	// These serve their own HTML — presence confirms Astro is not the renderer.
	{
		cms: "Ghost",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Ghost/i),
	},
	{
		cms: "Ghost",
		cmsType: "full-site",
		confidence: "medium",
		match: (html) =>
			/cdn\.ghost\.io|ghost\.io\/content\/|\/ghost\/api\//i.test(html),
	},
	{
		cms: "Substack",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /substackcdn\.com|substack\.com\/publish/i.test(html),
	},
	{
		cms: "Drupal",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Drupal/i),
	},
	{
		cms: "Drupal",
		cmsType: "full-site",
		confidence: "medium",
		match: (html) => /\/sites\/default\/files\/|Drupal\.settings/i.test(html),
	},
	{
		cms: "Joomla",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Joomla/i),
	},
	{
		cms: "Craft CMS",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Craft CMS/i),
	},
	{
		cms: "Kirby",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Kirby/i),
	},
	{
		cms: "TYPO3",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /TYPO3/i),
	},
	{
		cms: "Statamic",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Statamic/i),
	},

	// ── Page builders / hosted platforms ──────────────────────────────────
	{
		cms: "Webflow",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Webflow/i),
	},
	{
		cms: "Webflow",
		cmsType: "page-builder",
		confidence: "high",
		// Webflow sets these as attributes on <html>, not a meta tag
		match: (html) => /data-wf-(?:page|site)=/i.test(html),
	},
	{
		cms: "Webflow",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /webflow\.com\/css|webflow-badge/i.test(html),
	},
	{
		cms: "Squarespace",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Squarespace/i),
	},
	{
		cms: "Wix",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Wix\.com/i),
	},
	{
		cms: "Wix",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /static\.wixstatic\.com/i.test(html),
	},
	{
		cms: "Framer",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /framerusercontent\.com|framer\.com\/m\//i.test(html),
	},
	{
		cms: "Notion",
		cmsType: "page-builder",
		confidence: "high",
		match: (html, _, url) => /notion\.so|notion\.site/.test(url),
	},
	{
		cms: "Shopify",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) =>
			/cdn\.shopify\.com|myshopify\.com|Shopify\.theme/i.test(html),
	},
	{
		cms: "Shopify",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /<meta[^>]+name="shopify-checkout-api-token"/i.test(html),
	},
	{
		cms: "HubSpot",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) =>
			hasGeneratorTag(html, /HubSpot/i) || /name="hub-spot-id"/i.test(html),
	},
	{
		cms: "HubSpot",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) =>
			/js\.hs-scripts\.com|js\.hsforms\.net|js\.hubspot\.com/i.test(html),
	},

	// ── Astro-native frameworks ────────────────────────────────────────────
	// Starlight is built on Astro — its generator tag implies Astro.
	{
		cms: "Starlight",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Starlight/i),
	},

	// ── Static site generators (useful signal even if not a "CMS") ─────────
	{
		cms: "Hugo",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Hugo/i),
	},
	{
		cms: "Eleventy",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Eleventy/i),
	},
	{
		cms: "Jekyll",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Jekyll/i),
	},
	{
		cms: "Gatsby",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Gatsby/i),
	},
	{
		cms: "Gatsby",
		cmsType: "static-gen",
		confidence: "medium",
		// ___gatsby root div is injected by Gatsby's runtime
		match: (html) => /id="___gatsby"/.test(html),
	},
	{
		cms: "Hexo",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Hexo/i),
	},
	{
		cms: "VitePress",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /VitePress/i),
	},
	{
		cms: "Umbraco",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => hasGeneratorTag(html, /Umbraco/i),
	},

	// ── JS frameworks (not CMSs, but indicate the site is no longer Astro) ──
	{
		cms: "Next.js",
		cmsType: "framework",
		confidence: "high",
		// __NEXT_DATA__ script = Pages Router; __next_f = App Router streaming
		match: (html) => /id="__NEXT_DATA__"|__next_f\b/i.test(html),
	},
	{
		cms: "Next.js",
		cmsType: "framework",
		confidence: "high",
		match: (html) => /\/_next\/static\//i.test(html),
	},
	{
		cms: "Nuxt",
		cmsType: "framework",
		confidence: "high",
		// __nuxt div or /__nuxt_error = Nuxt rendering
		match: (html) =>
			/id="__nuxt"|__NUXT_DATA__|__nuxt_error|\/_nuxt\//i.test(html),
	},
	{
		cms: "SvelteKit",
		cmsType: "framework",
		confidence: "high",
		// \bsveltekit\b deliberately omitted — it appears in marketing copy on non-SvelteKit sites
		match: (html) =>
			/__sveltekit_|data-sveltekit-|svelte-announcer/i.test(html),
	},
	{
		cms: "Remix",
		cmsType: "framework",
		confidence: "high",
		match: (html) =>
			/__remixContext|__remix-error|\/_build\/entry\.client\./i.test(html),
	},

	// ── Parked / expired / for-sale domains ───────────────────────────────────
	// GoDaddy parking pages load assets from wsimg.com or trafficmanager
	makeParkedDetector(
		"GoDaddy",
		/wsimg\.com\/parking|godaddy\.com\/traf|Buy this domain.*GoDaddy|GoDaddy.*for sale/i,
		/godaddy\.com/i,
	),
	makeParkedDetector("Sedo", /sedo\.com|<div[^>]+id="sedo_/i, /sedo\.com/i),
	makeParkedDetector(
		"Dan.com",
		/[^a-z]dan\.com\/|buy.*dan\.com/i,
		/\bdan\.com$/i,
	),
	makeParkedDetector("Afternic", /afternic\.com/i, /afternic\.com/i),
	// GoDaddy-family marketplace, localized per-TLD (aftermarket.com/.pl/.eu/...)
	makeParkedDetector(
		"Aftermarket",
		/aftermarket\.[a-z]{2,4}\b/i,
		/aftermarket\.[a-z]{2,4}\b/i,
	),
	makeParkedDetector(
		"Dynadot",
		/forsale\.dynadot\.com/i,
		/forsale\.dynadot\.com/i,
	),
	{
		cms: "Namecheap",
		cmsType: "parked",
		confidence: "high",
		match: (html) =>
			/courtesy of namecheap|namecheap\.com.*parking|parking\.namecheap/i.test(
				html,
			),
	},
	{
		cms: "Bodis",
		cmsType: "parked",
		confidence: "high",
		match: (html) => /bodis\.com/i.test(html),
	},
	{
		cms: "ParkingCrew",
		cmsType: "parked",
		confidence: "high",
		match: (html) => /parkingcrew\.net/i.test(html),
	},
	{
		cms: "Parked",
		cmsType: "parked",
		confidence: "medium",
		// Generic parking page indicators
		match: (html) =>
			/<title>[^<]*(domain for sale|this domain is for sale|buy this domain|domain parked)[^<]*<\/title>/i.test(
				html,
			) || /this domain is parked|domain parking/i.test(html),
	},
];

// Matches a generator meta tag regardless of attribute order:
//   <meta name="generator" content="Astro v5">  ← name first
//   <meta content="Astro v5" name=generator>    ← content first (minified HTML)
function hasGeneratorTag(html: string, value: RegExp): boolean {
	for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
		const attrs = m[1];
		if (/\bname\s*=\s*["']?generator["']?/i.test(attrs) && value.test(attrs))
			return true;
	}
	return false;
}

function extractAstroVersion(html: string): string | null {
	for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
		const attrs = m[1];
		if (!/\bname\s*=\s*["']?generator["']?/i.test(attrs)) continue;
		const v = attrs.match(/Astro\s+v?([\d]+\.[\d]+\.[\d]+[\w.-]*)/i);
		if (v) return v[1];
	}
	return null;
}

function extractStarlightVersion(html: string): string | null {
	for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
		const attrs = m[1];
		if (!/\bname\s*=\s*["']?generator["']?/i.test(attrs)) continue;
		const v = attrs.match(/Starlight\s+v?([\d]+\.[\d]+\.[\d]+[\w.-]*)/i);
		if (v) return v[1];
	}
	return null;
}

function detectAstro(html: string): {
	detected: boolean;
	version: string | null;
	starlightVersion: string | null;
	signals: string[];
} {
	const signals: string[] = [];
	if (hasGeneratorTag(html, /Astro/i)) signals.push("generator meta tag");
	// Starlight is an Astro-native framework — its generator tag confirms Astro
	if (hasGeneratorTag(html, /Starlight/i))
		signals.push("Starlight generator tag");
	// data-astro-* on any element (cid, transition, source, etc.) — all Astro-specific
	if (/data-astro-/i.test(html)) signals.push("data-astro- attribute");
	// /_astro/ is the asset path used by Astro 2+
	if (/\/_astro\//i.test(html)) signals.push("/_astro/ asset path");
	if (/<astro-island/i.test(html)) signals.push("<astro-island> element");
	// :where(.astro-XXXXXX) — Astro scoped CSS selector pattern
	if (/:where\s*\(\.astro-[\w-]+\)/i.test(html))
		signals.push(":where(.astro-) CSS");
	// [data-astro-...] in inline <style> blocks
	if (/\[data-astro-[^\]]*\]/i.test(html))
		signals.push("data-astro CSS selector");
	// astro- prefixed class on any element (body-level signal)
	if (/class\s*=\s*["'][^"']*\bastro-[\w]/i.test(html))
		signals.push("astro- class");
	// hoisted.js was used by Astro 0.x / early 1.x before the /_astro/ convention
	if (/hoisted\.js/i.test(html)) signals.push("hoisted.js (Astro <2)");
	return {
		detected: signals.length > 0,
		version: extractAstroVersion(html),
		starlightVersion: extractStarlightVersion(html),
		signals,
	};
}

function isBotChallenge(
	html: string,
	headers: Record<string, string>,
): boolean {
	// Cloudflare JS/CAPTCHA challenge pages — fetch can't solve these
	if (headers["cf-mitigated"] === "challenge") return true;
	if (
		headers["cf-ray"] &&
		/<title>\s*(Just a moment|Attention Required)/i.test(html)
	)
		return true;
	if (
		/cf_chl_opt|cf-browser-verification|__cf_chl_jschl_tk__|cfreload/i.test(
			html,
		)
	)
		return true;
	// Cloudflare challenge platform assets
	if (/cdn-cgi\/challenge-platform/i.test(html)) return true;
	if (/_cf_chl_opt/i.test(html)) return true;
	if (/cf-spinner/i.test(html)) return true;
	// CAPTCHA / verification redirects via meta-refresh
	if (/\.well-known\/sgcaptcha/i.test(html)) return true;
	if (/<meta[^>]+refresh[^>]+(?:sgcaptcha|challenge|verify)/i.test(html))
		return true;
	return false;
}

function fingerprint(
	html: string,
	headers: Record<string, string>,
	url: string,
	finalUrl?: string,
): {
	cms: string;
	cmsType: CmsType;
	confidence: Confidence;
	evidence: string[];
	framework: string | null;
} | null {
	if (isBotChallenge(html, headers)) {
		return {
			cms: "Blocked",
			cmsType: "unknown",
			confidence: "high",
			evidence: ["Cloudflare challenge page"],
			framework: null,
		};
	}
	// Prefer high-confidence matches; collect best CMS hit and best framework hit separately
	let cmsHit: (typeof RULES)[number] | null = null;
	let frameworkHit: (typeof RULES)[number] | null = null;
	for (const conf of ["high", "medium", "low"] as Confidence[]) {
		for (const rule of RULES) {
			if (rule.confidence !== conf) continue;
			if (!rule.match(html, headers, url, finalUrl)) continue;
			if (rule.cmsType === "framework") {
				frameworkHit ??= rule;
			} else {
				cmsHit ??= rule;
			}
		}
		if (cmsHit) break; // framework hits continue scanning lower confidence if needed
	}
	if (!frameworkHit) {
		for (const conf of ["high", "medium", "low"] as Confidence[]) {
			for (const rule of RULES) {
				if (rule.cmsType !== "framework" || rule.confidence !== conf) continue;
				if (rule.match(html, headers, url, finalUrl)) {
					frameworkHit = rule;
					break;
				}
			}
			if (frameworkHit) break;
		}
	}
	if (cmsHit) {
		return {
			cms: cmsHit.cms,
			cmsType: cmsHit.cmsType,
			confidence: cmsHit.confidence,
			evidence: [`${cmsHit.confidence} confidence rule matched`],
			framework: frameworkHit?.cms ?? null,
		};
	}
	// Fallback: domain changed entirely = forwarded/sold to an unrecognised destination
	if (finalUrl) {
		try {
			const inHost = new URL(url).hostname.replace(/^www\./, "");
			const outHost = new URL(finalUrl).hostname.replace(/^www\./, "");
			if (inHost !== outHost) {
				return {
					cms: "Forwarded",
					cmsType: "parked",
					confidence: "high",
					evidence: [`Redirected to ${outHost}`],
					framework: frameworkHit?.cms ?? null,
				};
			}
		} catch {
			/* malformed URL — ignore */
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Fetcher with timeout
// ---------------------------------------------------------------------------

const UA =
	"Mozilla/5.0 (compatible; cms-detector/1.0; +https://github.com/withastro/astro.build)";

const baseHeaders = {
	"User-Agent": UA,
	Accept: "text/html,application/xhtml+xml",
	"Accept-Language": "en-US,en;q=0.5",
};

async function fetchSite(
	url: string,
	timeoutMs = 10_000,
): Promise<{
	html: string;
	headers: Record<string, string>;
	finalUrl: string;
	viaHttpFallback: boolean;
}> {
	try {
		const result = await attemptFetch(url, timeoutMs);
		return { ...result, viaHttpFallback: false };
	} catch (err) {
		// Some sites reject HTTPS at the TLS layer for non-browser clients (a
		// WAF fingerprinting Node's TLS ClientHello — no header/UA change fixes
		// this) while working fine in a real browser. dns-check.mjs already
		// falls back to plain HTTP here, but only ever reads the status code
		// as a coarse liveness signal — it never treats the response body as
		// real content. That distinction matters: confirmed live that a site's
		// plain-HTTP endpoint can serve something entirely unrelated to the
		// real HTTPS site (corsfix.com's HTTP endpoint redirects to an
		// unrelated Tesco Mobile page while the real site works fine in
		// Safari over HTTPS). So this fallback exists only to distinguish
		// "genuinely unreachable" from "reachable but unverifiable" — the
		// caller must NOT fingerprint this content as the site (see
		// `viaHttpFallback` in processSite).
		if (url.startsWith("https://")) {
			try {
				const result = await attemptFetch(
					url.replace(/^https:/, "http:"),
					timeoutMs,
				);
				return { ...result, viaHttpFallback: true };
			} catch {
				throw err; // the original https failure is more informative
			}
		}
		throw err;
	}
}

async function attemptFetch(
	url: string,
	timeoutMs: number,
): Promise<{
	html: string;
	headers: Record<string, string>;
	finalUrl: string;
}> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		// First pass: manual redirect to collect cookies (handles cookie-gated redirects)
		let res = await fetch(url, {
			signal: controller.signal,
			headers: baseHeaders,
			redirect: "manual",
		});

		// Collect cookies from the first response
		const setCookie = res.headers.get("set-cookie");
		const cookies = setCookie
			? setCookie
					.split(",")
					.map((c) => c.trim().split(";")[0])
					.filter(Boolean)
			: [];

		// If the server redirected, follow properly with cookies attached
		if (res.status >= 300 && res.status < 400) {
			res = await fetch(url, {
				signal: controller.signal,
				headers: {
					...baseHeaders,
					...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
				},
				redirect: "follow",
			});
		}

		let html = await res.text();
		let finalUrl = res.url;
		const headers: Record<string, string> = {};
		res.headers.forEach((v, k) => {
			headers[k.toLowerCase()] = v;
		});

		// Follow <meta http-equiv="refresh" content="0;url=..."> client-side redirects
		// e.g. docs.astro.build serves a 200 with only a meta-refresh, no Astro fingerprints.
		const metaRefresh =
			html.match(
				/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'\s>]+)/i,
			) ??
			html.match(
				/<meta[^>]+content=["'][^"']*url=([^"'\s>]+)[^"']*["'][^>]+http-equiv=["']?refresh["']?/i,
			);
		if (metaRefresh) {
			const redirectTarget = new URL(metaRefresh[1], finalUrl).href;
			try {
				const res2 = await fetch(redirectTarget, {
					signal: controller.signal,
					headers: baseHeaders,
					redirect: "follow",
				});
				html = await res2.text();
				finalUrl = res2.url;
				res2.headers.forEach((v, k) => {
					headers[k.toLowerCase()] = v;
				});
			} catch {
				// meta-refresh follow failed — keep the original response
			}
		}

		return { html, headers, finalUrl };
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

function createQueue(concurrency: number) {
	let running = 0;
	const queue: Array<() => void> = [];

	function next() {
		if (running >= concurrency || queue.length === 0) return;
		running++;
		const run = queue.shift()!;
		run();
	}

	return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			queue.push(() => {
				fn()
					.then(resolve)
					.catch(reject)
					.finally(() => {
						running--;
						next();
					});
			});
			next();
		});
	};
}

// ---------------------------------------------------------------------------
// Main helpers
// ---------------------------------------------------------------------------

async function ensureShowcaseCache(
	sourceDir: string,
	cacheRoot: string,
	isDefaultSource: boolean,
): Promise<void> {
	const showcaseRepo = "https://github.com/withastro/astro.build.git";
	let sourceMissing = false;
	try {
		await access(sourceDir);
	} catch {
		sourceMissing = true;
	}
	if (sourceMissing) {
		if (!isDefaultSource) {
			console.error(`Error: source directory not found: ${sourceDir}`);
			process.exit(1);
		}
		console.log(
			"Showcase cache not found — cloning astro.build (sparse, yml only)…",
		);
		execSync(
			`git clone --filter=blob:none --sparse "${showcaseRepo}" "${cacheRoot}"`,
			{ stdio: "inherit" },
		);
		execSync(
			`git -C "${cacheRoot}" sparse-checkout set --no-cone "src/content/showcase/*.yml"`,
			{ stdio: "inherit" },
		);
		console.log("Clone complete.");
	} else if (isDefaultSource) {
		// Pull latest changes to keep the cache fresh
		console.log("Updating showcase cache…");
		try {
			execSync(`git -C "${cacheRoot}" pull --ff-only`, { stdio: "inherit" });
		} catch {
			console.warn(
				"Warning: could not pull latest changes (offline or conflict). Using cached data.",
			);
		}
	}
}

async function trySecondPass(
	url: string,
	timeoutMs: number,
): Promise<{ astro: ReturnType<typeof detectAstro>; finalUrl: string } | null> {
	try {
		const res = await fetchSite(url, timeoutMs);
		const astro = detectAstro(res.html);
		return astro.detected ? { astro, finalUrl: res.finalUrl } : null;
	} catch {
		return null;
	}
}

async function processSite(
	entry: ShowcaseEntry,
	timeoutMs: number,
): Promise<CmsResult> {
	try {
		const { html, headers, finalUrl, viaHttpFallback } = await fetchSite(
			entry.url,
			timeoutMs,
		);

		// The HTTPS fetch failed (TLS-level block, expired cert, etc.) and we
		// only got here via the plain-HTTP fallback. Its content isn't
		// necessarily the real site — don't fingerprint it as CMS/Astro
		// evidence, or a site whose HTTP endpoint redirects elsewhere gets
		// confidently misclassified as whatever that unrelated page is.
		if (viaHttpFallback) {
			return {
				title: entry.title,
				url: entry.url,
				cms: "Blocked",
				cmsType: "unknown",
				confidence: "high",
				evidence: [
					"HTTPS fetch failed (TLS-level block); HTTP fallback succeeded but its content isn't verified as the real site",
				],
				astroDetected: false,
				astroVersion: null,
				starlightVersion: null,
				astroSignals: [],
				framework: null,
				// Not the real site's redirect — just where the unverified HTTP-only
				// fallback happened to land. Showing it as `finalUrl` would read as
				// "this site forwards to X", which we have no evidence for.
				finalUrl: null,
				categories: entry.categories ?? [],
				dateAdded: entry.dateAdded,
				fetchedAt: new Date().toISOString(),
			};
		}

		const hit = fingerprint(html, headers, entry.url, finalUrl);
		let astro = detectAstro(html);
		let deepFinalUrl = finalUrl;

		// For forwarded sites where Astro wasn't detected, make one extra pass
		// directly on the redirect destination. The intermediate URL may use a
		// JS redirect or further HTTP redirect (e.g. /docs/ → /docs/public/) that
		// the first fetch didn't follow all the way to the actual Astro content.
		if (hit?.cms === "Forwarded" && !astro.detected && finalUrl) {
			const second = await trySecondPass(finalUrl, timeoutMs);
			if (second) {
				astro = second.astro;
				deepFinalUrl = second.finalUrl;
			}
		}

		const resolvedUrl = deepFinalUrl !== entry.url ? deepFinalUrl : null;
		// If Astro was detected, we got real content through —
		// a "Blocked" label or "parked" classification on top of real Astro HTML
		// is misleading, so demote it to Unknown in that case.
		// Demote classifications that are incompatible with a confirmed Astro site:
		// parked/for-sale pages, full-site platforms (WordPress, Wix, etc.), and bot challenges.
		const effectiveHit =
			(hit?.cms === "Blocked" ||
				hit?.cmsType === "full-site" ||
				(hit?.cmsType === "parked" && hit?.cms !== "Forwarded")) &&
			astro.detected
				? null
				: hit;
		return {
			title: entry.title,
			url: entry.url,
			cms: effectiveHit?.cms ?? "Unknown",
			cmsType: effectiveHit?.cmsType ?? "unknown",
			confidence: effectiveHit?.confidence ?? null,
			evidence: effectiveHit?.evidence ?? [],
			astroDetected: astro.detected,
			astroVersion: astro.version,
			starlightVersion: astro.starlightVersion,
			astroSignals: astro.signals,
			framework: effectiveHit?.framework ?? null,
			finalUrl: resolvedUrl,
			categories: entry.categories ?? [],
			dateAdded: entry.dateAdded,
			fetchedAt: new Date().toISOString(),
		};
	} catch (err) {
		return {
			title: entry.title,
			url: entry.url,
			cms: "Error",
			cmsType: "unknown",
			confidence: null,
			evidence: [],
			astroDetected: false,
			astroVersion: null,
			starlightVersion: null,
			astroSignals: [],
			framework: null,
			finalUrl: null,
			categories: entry.categories ?? [],
			dateAdded: entry.dateAdded,
			fetchedAt: new Date().toISOString(),
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

function printSummary(allResults: CmsResult[], outputFile: string): void {
	const cmsCounts = new Map<string, number>();
	for (const r of allResults) {
		cmsCounts.set(r.cms, (cmsCounts.get(r.cms) ?? 0) + 1);
	}
	const sorted = [...cmsCounts.entries()].sort((a, b) => b[1] - a[1]);

	console.log("─── Results ───────────────────────────────");
	for (const [cms, count] of sorted) {
		const pct = ((count / allResults.length) * 100).toFixed(1);
		console.log(
			`  ${cms.padEnd(20)} ${count.toString().padStart(4)}  (${pct}%)`,
		);
	}
	console.log(`\nWrote ${allResults.length} results → ${outputFile}`);
}

function printSection(label: string, items: string[]): void {
	if (!items.length) return;
	console.log(`\n  ${label} (${items.length}):`);
	for (const l of items) console.log(l);
}

interface ChangeLog {
	newSites: string[];
	newAstro: string[];
	lostAstro: string[];
	versionChanged: string[];
	cmsChanged: string[];
}

function classifyResult(r: CmsResult, prev: CmsResult, log: ChangeLog): void {
	const label = r.title || r.url;
	if (!prev.astroDetected && r.astroDetected)
		log.newAstro.push(
			`  + ${label} → now Astro${r.astroVersion ? ` v${r.astroVersion}` : ""}`,
		);
	if (prev.astroDetected && !r.astroDetected)
		log.lostAstro.push(`  - ${label} → ${r.cms}`);
	if (
		prev.astroVersion !== r.astroVersion &&
		r.astroVersion &&
		prev.astroVersion
	)
		log.versionChanged.push(
			`  ~ ${label}: v${prev.astroVersion} → v${r.astroVersion}`,
		);
	if (prev.cms !== r.cms)
		log.cmsChanged.push(`  ~ ${label}: ${prev.cms} → ${r.cms}`);
}

function collectChanges(
	allResults: CmsResult[],
	previousResults: Map<string, CmsResult>,
): ChangeLog {
	const log: ChangeLog = {
		newSites: [],
		newAstro: [],
		lostAstro: [],
		versionChanged: [],
		cmsChanged: [],
	};
	for (const r of allResults) {
		const prev = previousResults.get(r.url);
		if (!prev) {
			log.newSites.push(r.title || r.url);
			continue;
		}
		classifyResult(r, prev, log);
	}
	return log;
}

function printChanges(
	allResults: CmsResult[],
	previousResults: Map<string, CmsResult>,
): void {
	if (previousResults.size === 0) return;
	const { newSites, newAstro, lostAstro, versionChanged, cmsChanged } =
		collectChanges(allResults, previousResults);
	const hasChanges =
		newSites.length ||
		newAstro.length ||
		lostAstro.length ||
		versionChanged.length ||
		cmsChanged.length;

	console.log("\n─── Changes vs previous run ───────────────");
	if (newSites.length)
		console.log(`  ${newSites.length} new site(s) added to showcase`);
	printSection("Newly detected as Astro", newAstro);
	printSection("No longer detected as Astro", lostAstro);
	printSection("Astro version changed", versionChanged);
	printSection("CMS changed", cmsChanged);
	if (!hasChanges) console.log("  No changes detected.");
}

// ---------------------------------------------------------------------------
// Main helpers
// ---------------------------------------------------------------------------

async function loadPreviousResults(
	outputFile: string,
): Promise<Map<string, CmsResult>> {
	const map = new Map<string, CmsResult>();
	try {
		const prev: ResultsFile = JSON.parse(await readFile(outputFile, "utf8"));
		for (const r of prev.results) map.set(r.url, r);
		console.log(`Loaded ${map.size} previous results for comparison`);
	} catch {
		// No previous results — comparison will be skipped
	}
	return map;
}

async function loadExistingResults(
	outputFile: string,
	resume: boolean,
	errorsOnly: boolean,
	forwardedOnly: boolean,
): Promise<Map<string, CmsResult>> {
	if (!resume && !errorsOnly && !forwardedOnly) return new Map();
	const map = new Map<string, CmsResult>();
	try {
		const existing: ResultsFile = JSON.parse(
			await readFile(outputFile, "utf8"),
		);
		for (const r of existing.results) map.set(r.url, r);
		if (resume) {
			console.log(`Resuming: ${map.size} already processed`);
		} else if (errorsOnly) {
			const count = [...map.values()].filter((r) => r.cms === "Error").length;
			console.log(`Errors only: ${count} sites to retry`);
		} else {
			const count = [...map.values()].filter(
				(r) => r.cms === "Forwarded" && !r.astroDetected,
			).length;
			console.log(`Forwarded (non-Astro) only: ${count} sites to retry`);
		}
	} catch {
		console.log("No existing results found, starting fresh");
	}
	return map;
}

function buildFetchList(
	entries: ShowcaseEntry[],
	existingResults: Map<string, CmsResult>,
	resume: boolean,
	errorsOnly: boolean,
	forwardedOnly: boolean,
	limit: number | undefined,
): { toFetch: ShowcaseEntry[]; skippedCount: number } {
	const toProcess = limit ? entries.slice(0, limit) : entries;
	let toFetch: ShowcaseEntry[];
	if (resume) toFetch = toProcess.filter((e) => !existingResults.has(e.url));
	else if (errorsOnly)
		toFetch = toProcess.filter(
			(e) => existingResults.get(e.url)?.cms === "Error",
		);
	else if (forwardedOnly)
		toFetch = toProcess.filter((e) => {
			const r = existingResults.get(e.url);
			return r?.cms === "Forwarded" && !r.astroDetected;
		});
	else toFetch = toProcess;
	return { toFetch, skippedCount: toProcess.length - toFetch.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const startMs = Date.now();

	const { values: args } = parseArgs({
		args: process.argv.slice(2).filter((a) => a !== "--"),
		options: {
			source: {
				type: "string",
				default: ".showcase-cache/src/content/showcase",
			},
			output: {
				type: "string",
				default: "src/data/cms-results.json",
			},
			limit: { type: "string" },
			concurrency: { type: "string", default: "6" },
			resume: { type: "boolean", default: false },
			"errors-only": { type: "boolean", default: false },
			"forwarded-only": { type: "boolean", default: false },
			timeout: { type: "string", default: "10000" },
		},
	});

	const sourceDir = resolve(args.source as string);
	const outputFile = resolve(args.output as string);
	const concurrency = Number.parseInt(args.concurrency as string, 10);
	const timeoutMs = Number.parseInt(args.timeout as string, 10);
	const limit = args.limit
		? Number.parseInt(args.limit as string, 10)
		: undefined;
	const resume = args.resume as boolean;
	const errorsOnly = args["errors-only"] as boolean;
	const forwardedOnly = args["forwarded-only"] as boolean;

	const cacheRoot = resolve(".showcase-cache");
	const isDefaultSource =
		sourceDir === resolve(".showcase-cache/src/content/showcase");
	await ensureShowcaseCache(sourceDir, cacheRoot, isDefaultSource);

	console.log(`Source: ${sourceDir}`);
	console.log(`Output: ${outputFile}`);
	console.log(`Concurrency: ${concurrency} | Timeout: ${timeoutMs}ms`);
	if (limit) console.log(`Limit: ${limit}`);

	const previousResults = await loadPreviousResults(outputFile);
	const existingResults = await loadExistingResults(
		outputFile,
		resume,
		errorsOnly,
		forwardedOnly,
	);

	// Read all showcase YAMLs
	const files = (await readdir(sourceDir)).filter((f) => f.endsWith(".yml"));
	const entries: ShowcaseEntry[] = [];
	for (const file of files) {
		const content = await readFile(join(sourceDir, file), "utf8");
		const entry = parseShowcaseYaml(content);
		if (entry) entries.push(entry);
	}

	const { toFetch, skippedCount } = buildFetchList(
		entries,
		existingResults,
		resume,
		errorsOnly,
		forwardedOnly,
		limit,
	);
	console.log(
		`\nProcessing ${toFetch.length} sites (${skippedCount} skipped/resumed)`,
	);

	const enqueue = createQueue(concurrency);
	let done = 0;
	const fresh: CmsResult[] = [];

	const tasks = toFetch.map((entry) =>
		enqueue(async () => {
			const result = await processSite(entry, timeoutMs);
			fresh.push(result);
			done++;
			if (done % 50 === 0 || done === toFetch.length)
				process.stdout.write(`\r  ${done}/${toFetch.length}`);
			return result;
		}),
	);

	await Promise.all(tasks);
	console.log("\n");

	// Merge with existing
	const allResults = [
		...fresh,
		...(resume || errorsOnly || forwardedOnly
			? [...existingResults.values()].filter(
					(r) => !fresh.find((f) => f.url === r.url),
				)
			: []),
	].sort((a, b) => a.title.localeCompare(b.title));

	// Safety guard: if we were merging with existing results and the merged total
	// is drastically smaller than what we started with, something went wrong — bail
	// rather than silently overwrite good data with an empty or truncated file.
	if (
		(resume || errorsOnly || forwardedOnly) &&
		existingResults.size > 0 &&
		allResults.length < existingResults.size * 0.5
	) {
		console.error(
			`\n⛔ Merge safety check failed: expected ~${existingResults.size} results, got ${allResults.length}. Aborting write to protect existing data.\n`,
		);
		process.exit(1);
	}

	const output: ResultsFile = {
		generated: new Date().toISOString(),
		sourceDir: sourceDir.replace(`${process.cwd()}/`, ""),
		total: allResults.length,
		results: allResults,
	};

	await writeFile(outputFile, JSON.stringify(output, null, "\t"), "utf8");

	printSummary(allResults, outputFile);

	// ── Write scan to local history DB ───────────────────────────────────────
	try {
		const scanId = writeScanToDb(allResults, output, Date.now() - startMs);
		console.log(`DB: scan #${scanId} saved → .scan-history.db`);
	} catch (err) {
		console.warn(
			`DB write skipped (non-fatal): ${err instanceof Error ? err.message : err}`,
		);
	}

	printChanges(allResults, previousResults);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
