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

import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

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
	astroSignals: string[];
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

interface Rule {
	cms: string;
	cmsType: CmsType;
	confidence: Confidence;
	match: (
		html: string,
		headers: Record<string, string>,
		url: string,
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
		match: (html) => /datocms-assets\.com|dato-cms/i.test(html),
	},
	{
		cms: "Hygraph",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /hygraph\.com|graphcms\.com/i.test(html),
	},
	{
		cms: "Directus",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /directus\.io|\/directus\//i.test(html),
	},
	{
		cms: "Strapi",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /strapi\.io|\/strapi\//i.test(html),
	},
	{
		cms: "Payload CMS",
		cmsType: "headless-cms",
		confidence: "medium",
		match: (html) => /payloadcms\.com|payload-cms/i.test(html),
	},
	{
		cms: "Builder.io",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /cdn\.builder\.io|builder\.io/i.test(html),
	},
	{
		cms: "Kontent.ai",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) =>
			/kontent\.ai|assets-us-01\.kc-usercontent\.com/i.test(html),
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
		match: (html) => /crystallize\.com|media\.crystallize\.com/i.test(html),
	},
	{
		cms: "Tina CMS",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /tina\.io|tinacms/i.test(html),
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
		match: (html) => /keystatic/i.test(html),
	},
	{
		cms: "Caisy",
		cmsType: "headless-cms",
		confidence: "high",
		match: (html) => /caisy\.io/i.test(html),
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
		match: (html) => /<meta[^>]+generator[^>]*WordPress/i.test(html),
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
		match: (html) =>
			/\/wp-content\/uploads\//i.test(html) &&
			!/\/wp-content\/(?:themes|plugins)\/|\/wp-includes\//i.test(html),
	},

	// ── Other full-site CMSs ───────────────────────────────────────────────
	// These serve their own HTML — presence confirms Astro is not the renderer.
	{
		cms: "Ghost",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Ghost/i.test(html),
	},
	{
		cms: "Ghost",
		cmsType: "full-site",
		confidence: "medium",
		match: (html) => /ghost\.io|\/ghost\//i.test(html),
	},
	{
		cms: "Drupal",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Drupal/i.test(html),
	},
	{
		cms: "Drupal",
		cmsType: "full-site",
		confidence: "medium",
		match: (html) => /sites\/default\/files\//i.test(html),
	},
	{
		cms: "Joomla",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Joomla/i.test(html),
	},
	{
		cms: "Craft CMS",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Craft CMS/i.test(html),
	},
	{
		cms: "Kirby",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Kirby/i.test(html),
	},
	{
		cms: "TYPO3",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*TYPO3/i.test(html),
	},
	{
		cms: "Statamic",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Statamic/i.test(html),
	},

	// ── Page builders / hosted platforms ──────────────────────────────────
	{
		cms: "Webflow",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Webflow/i.test(html),
	},
	{
		cms: "Webflow",
		cmsType: "page-builder",
		confidence: "high",
		// Platform-specific meta tags Webflow injects on every page
		match: (html) => /<meta[^>]+name="wf-(?:page|site)"/i.test(html),
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
		match: (html) => /<meta[^>]+generator[^>]*Squarespace/i.test(html),
	},
	{
		cms: "Wix",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Wix\.com/i.test(html),
	},
	{
		cms: "Wix",
		cmsType: "page-builder",
		confidence: "high",
		match: (html) => /static\.wixstatic\.com|wix\.com/i.test(html),
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
			/<meta[^>]+(?:name="generator"[^>]*content="HubSpot|name="hub-spot-id")/i.test(
				html,
			),
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
		match: (html) => /<meta[^>]+generator[^>]*Starlight/i.test(html),
	},

	// ── Static site generators (useful signal even if not a "CMS") ─────────
	{
		cms: "Hugo",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Hugo/i.test(html),
	},
	{
		cms: "Eleventy",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Eleventy/i.test(html),
	},
	{
		cms: "Jekyll",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Jekyll/i.test(html),
	},
	{
		cms: "Gatsby",
		cmsType: "static-gen",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Gatsby/i.test(html),
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
		match: (html) => /<meta[^>]+generator[^>]*Hexo/i.test(html),
	},
	{
		cms: "Umbraco",
		cmsType: "full-site",
		confidence: "high",
		match: (html) => /<meta[^>]+generator[^>]*Umbraco/i.test(html),
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
		match: (html) =>
			/\bsveltekit\b|__sveltekit_|data-sveltekit-|svelte-announcer/i.test(html),
	},
	{
		cms: "Remix",
		cmsType: "framework",
		confidence: "high",
		match: (html) =>
			/__remixContext|__remix-error|\/_build\/entry\.client\./i.test(html),
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

function detectAstro(html: string): { detected: boolean; version: string | null; signals: string[] } {
	const signals: string[] = [];
	if (hasGeneratorTag(html, /Astro/i)) signals.push("generator meta tag");
	// Starlight is an Astro-native framework — its generator tag confirms Astro
	if (hasGeneratorTag(html, /Starlight/i))
		signals.push("Starlight generator tag");
	// data-astro-cid-* on any element = Astro scoped CSS (very reliable)
	if (/data-astro-cid-/i.test(html)) signals.push("data-astro-cid attribute");
	// /_astro/ is the asset path used by Astro 2+
	if (/\/_astro\//i.test(html)) signals.push("/_astro/ asset path");
	if (/<astro-island/i.test(html)) signals.push("<astro-island> element");
	// hoisted.js was used by Astro 0.x / early 1.x before the /_astro/ convention
	if (/hoisted\.js/i.test(html)) signals.push("hoisted.js (Astro <2)");
	return { detected: signals.length > 0, version: extractAstroVersion(html), signals };
}

function isCloudflareBlocked(
	html: string,
	headers: Record<string, string>,
): boolean {
	// Cloudflare JS/CAPTCHA challenge pages — fetch can't solve these
	if (headers["cf-mitigated"] === "challenge") return true;
	if (
		/cf_chl_opt|cf-browser-verification|__cf_chl_jschl_tk__|cfreload/i.test(
			html,
		)
	)
		return true;
	// "Just a moment..." or "Attention Required!" with a cf-ray header
	if (
		headers["cf-ray"] &&
		/<title>\s*(Just a moment|Attention Required)/i.test(html)
	)
		return true;
	return false;
}

function fingerprint(
	html: string,
	headers: Record<string, string>,
	url: string,
): {
	cms: string;
	cmsType: CmsType;
	confidence: Confidence;
	evidence: string[];
} | null {
	if (isCloudflareBlocked(html, headers)) {
		return {
			cms: "Blocked",
			cmsType: "unknown",
			confidence: "high",
			evidence: ["Cloudflare challenge page"],
		};
	}
	// Prefer high-confidence matches; return the first one found at that level
	for (const conf of ["high", "medium", "low"] as Confidence[]) {
		for (const rule of RULES) {
			if (rule.confidence !== conf) continue;
			if (rule.match(html, headers, url)) {
				return {
					cms: rule.cms,
					cmsType: rule.cmsType,
					confidence: rule.confidence,
					evidence: [`${rule.confidence} confidence rule matched`],
				};
			}
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Fetcher with timeout
// ---------------------------------------------------------------------------

async function fetchSite(
	url: string,
	timeoutMs = 10_000,
): Promise<{ html: string; headers: Record<string, string> }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; cms-detector/1.0; +https://github.com/withastro/astro.build)",
				Accept: "text/html,application/xhtml+xml",
			},
			redirect: "follow",
		});
		const html = await res.text();
		const headers: Record<string, string> = {};
		res.headers.forEach((v, k) => {
			headers[k.toLowerCase()] = v;
		});
		return { html, headers };
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
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { values: args } = parseArgs({
		args: process.argv.slice(2),
		options: {
			source: {
				type: "string",
				default: "/tmp/astro-build-showcase/src/content/showcase",
			},
			output: {
				type: "string",
				default: "src/data/cms-results.json",
			},
			limit: { type: "string" },
			concurrency: { type: "string", default: "6" },
			resume: { type: "boolean", default: false },
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

	console.log(`Source: ${sourceDir}`);
	console.log(`Output: ${outputFile}`);
	console.log(`Concurrency: ${concurrency} | Timeout: ${timeoutMs}ms`);
	if (limit) console.log(`Limit: ${limit}`);

	// Load existing results if resuming
	const existingResults = new Map<string, CmsResult>();
	if (resume) {
		try {
			const existing: ResultsFile = JSON.parse(
				await readFile(outputFile, "utf8"),
			);
			for (const r of existing.results) {
				existingResults.set(r.url, r);
			}
			console.log(`Resuming: ${existingResults.size} already processed`);
		} catch {
			console.log("No existing results found, starting fresh");
		}
	}

	// Read all showcase YAMLs
	const files = (await readdir(sourceDir)).filter((f) => f.endsWith(".yml"));
	const entries: ShowcaseEntry[] = [];

	for (const file of files) {
		const content = await readFile(join(sourceDir, file), "utf8");
		const entry = parseShowcaseYaml(content);
		if (entry) entries.push(entry);
	}

	const toProcess = limit ? entries.slice(0, limit) : entries;
	const toFetch = resume
		? toProcess.filter((e) => !existingResults.has(e.url))
		: toProcess;

	console.log(
		`\nProcessing ${toFetch.length} sites (${toProcess.length - toFetch.length} skipped/resumed)`,
	);

	const enqueue = createQueue(concurrency);
	let done = 0;
	const fresh: CmsResult[] = [];

	const tasks = toFetch.map((entry) =>
		enqueue(async () => {
			let result: CmsResult;
			try {
				const { html, headers } = await fetchSite(entry.url, timeoutMs);
				const hit = fingerprint(html, headers, entry.url);
				const astro = detectAstro(html);
				result = {
					title: entry.title,
					url: entry.url,
					cms: hit?.cms ?? "Unknown",
					cmsType: hit?.cmsType ?? "unknown",
					confidence: hit?.confidence ?? null,
					evidence: hit?.evidence ?? [],
					astroDetected: astro.detected,
					astroVersion: astro.version,
					astroSignals: astro.signals,
					categories: entry.categories ?? [],
					dateAdded: entry.dateAdded,
					fetchedAt: new Date().toISOString(),
				};
			} catch (err) {
				result = {
					title: entry.title,
					url: entry.url,
					cms: "Error",
					cmsType: "unknown",
					confidence: null,
					evidence: [],
					astroDetected: false,
					astroVersion: null,
					astroSignals: [],
					categories: entry.categories ?? [],
					dateAdded: entry.dateAdded,
					fetchedAt: new Date().toISOString(),
					error: err instanceof Error ? err.message : String(err),
				};
			}

			fresh.push(result);
			done++;
			if (done % 50 === 0 || done === toFetch.length) {
				process.stdout.write(`\r  ${done}/${toFetch.length}`);
			}
			return result;
		}),
	);

	await Promise.all(tasks);
	console.log("\n");

	// Merge with existing
	const allResults = [
		...fresh,
		...(resume
			? [...existingResults.values()].filter(
					(r) => !fresh.find((f) => f.url === r.url),
				)
			: []),
	].sort((a, b) => a.title.localeCompare(b.title));

	const output: ResultsFile = {
		generated: new Date().toISOString(),
		sourceDir,
		total: allResults.length,
		results: allResults,
	};

	await writeFile(outputFile, JSON.stringify(output, null, "\t"), "utf8");

	// Summary
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

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
