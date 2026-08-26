// scripts/recheck-blocked.ts
//
// Re-checks every site currently classified `cms: "Blocked"` in
// src/data/cms-results.json using a real browser (Playwright/Chromium)
// instead of a plain fetch. Some of these are blocked by a bot-check or TLS
// fingerprint that only rejects the Node fetch client, not a real browser —
// confirmed manually via Safari MCP spot-checks (see CHANGES.md, 2026-08-14).
//
// Read-only: does NOT write to cms-results.json or the scan-history DB.
// Reuses the exact same classification logic as `pnpm detect`
// (fingerprint/detectAstro from detect-cms.ts) so results are directly
// comparable — nothing here can drift out of sync with the real detector.
//
// Usage:
//   node --experimental-strip-types scripts/recheck-blocked.ts
//   node --experimental-strip-types scripts/recheck-blocked.ts -- --limit 20
//   node --experimental-strip-types scripts/recheck-blocked.ts -- --concurrency 3

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import type { CmsResult, ResultsFile } from "./detect-cms.ts";
import { createQueue, detectAstro, fingerprint } from "./detect-cms.ts";

const { values: args } = parseArgs({
	options: {
		limit: { type: "string" },
		concurrency: { type: "string", default: "4" },
		timeout: { type: "string", default: "20000" },
	},
});

const CONCURRENCY = Number.parseInt(args.concurrency as string, 10);
const TIMEOUT_MS = Number.parseInt(args.timeout as string, 10);
const LIMIT = args.limit ? Number.parseInt(args.limit, 10) : undefined;

const RESULTS_PATH = resolve("src/data/cms-results.json");
const REPORT_PATH = resolve("blocked-recheck-report.json");

interface RecheckOutcome {
	url: string;
	title: string;
	before: { cms: string; cmsType: string; astroDetected: boolean };
	after: { cms: string; cmsType: string; astroDetected: boolean };
	changed: boolean;
	error?: string;
	// Full CmsResult fields for `changed` entries — enough for merge-recheck-
	// results.ts to update cms-results.json/the DB without re-fetching.
	fullResult?: Pick<
		CmsResult,
		| "cms"
		| "cmsType"
		| "confidence"
		| "evidence"
		| "astroDetected"
		| "astroVersion"
		| "starlightVersion"
		| "astroSignals"
		| "finalUrl"
		| "fetchedAt"
	>;
}

async function recheckSite(
	url: string,
	title: string,
	browser: Awaited<ReturnType<typeof chromium.launch>>,
	before: CmsResult,
): Promise<RecheckOutcome> {
	const page = await browser.newPage({
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
	});
	try {
		const response = await page.goto(url, {
			waitUntil: "domcontentloaded",
			timeout: TIMEOUT_MS,
		});
		const html = await page.content();
		const headers = response?.headers() ?? {};
		const finalUrl = page.url();

		const rawHit = fingerprint(html, headers, url, finalUrl);
		const astro = detectAstro(html);
		const fetchedAt = new Date().toISOString();

		// Same demotion rule as detect-cms.ts's processSite(): a "Blocked"/
		// "full-site"/"parked" label sitting on top of confirmed Astro content
		// is misleading — we got real content through, so it's not actually
		// blocked/parked/CMS-rendered. fingerprint() alone doesn't apply this;
		// it's normally done by the caller.
		const hit =
			(rawHit?.cms === "Blocked" ||
				rawHit?.cmsType === "full-site" ||
				(rawHit?.cmsType === "parked" && rawHit?.cms !== "Forwarded")) &&
			astro.detected
				? null
				: rawHit;

		const after = {
			cms: hit?.cms ?? "Unknown",
			cmsType: hit?.cmsType ?? "unknown",
			astroDetected: astro.detected,
		};
		const beforeSummary = {
			cms: before.cms,
			cmsType: before.cmsType,
			astroDetected: before.astroDetected,
		};
		const changed =
			after.cms !== beforeSummary.cms ||
			after.astroDetected !== beforeSummary.astroDetected;

		return {
			url,
			title,
			before: beforeSummary,
			after,
			changed,
			fullResult: changed
				? {
						cms: after.cms,
						cmsType: after.cmsType,
						confidence: hit?.confidence ?? null,
						evidence: hit?.evidence ?? [],
						astroDetected: astro.detected,
						astroVersion: astro.version,
						starlightVersion: astro.starlightVersion,
						astroSignals: astro.signals,
						finalUrl: finalUrl !== url ? finalUrl : null,
						fetchedAt,
					}
				: undefined,
		};
	} catch (err) {
		return {
			url,
			title,
			before: {
				cms: before.cms,
				cmsType: before.cmsType,
				astroDetected: before.astroDetected,
			},
			after: { cms: "Blocked", cmsType: "unknown", astroDetected: false },
			changed: false,
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		await page.close();
	}
}

async function main() {
	const raw = await readFile(RESULTS_PATH, "utf8");
	const data: ResultsFile = JSON.parse(raw);
	let blocked = data.results.filter((r) => r.cms === "Blocked");
	if (LIMIT) blocked = blocked.slice(0, LIMIT);

	console.log(
		`Re-checking ${blocked.length} "Blocked" site(s) via real Chromium (concurrency: ${CONCURRENCY})…\n`,
	);

	const browser = await chromium.launch();
	const enqueue = createQueue(CONCURRENCY);
	let done = 0;

	const outcomes = await Promise.all(
		blocked.map((site) =>
			enqueue(async () => {
				const outcome = await recheckSite(site.url, site.title, browser, site);
				done++;
				const tag = outcome.error
					? "ERROR"
					: outcome.changed
						? "CHANGED"
						: "same";
				console.log(
					`[${done}/${blocked.length}] ${tag.padEnd(7)} ${site.url}${
						outcome.changed
							? ` — ${outcome.before.cms} → ${outcome.after.cms}`
							: ""
					}`,
				);
				return outcome;
			}),
		),
	);

	await browser.close();

	const changed = outcomes.filter((o) => o.changed);
	const stillErroring = outcomes.filter((o) => o.error);

	await writeFile(
		REPORT_PATH,
		JSON.stringify(
			{
				generated: new Date().toISOString(),
				totalChecked: outcomes.length,
				changedCount: changed.length,
				erroredCount: stillErroring.length,
				changed,
				all: outcomes,
			},
			null,
			2,
		),
	);

	console.log(`\n${"─".repeat(60)}`);
	console.log(
		`Done. ${changed.length} changed, ${stillErroring.length} still erroring, ${
			outcomes.length - changed.length - stillErroring.length
		} confirmed still Blocked/same.`,
	);
	console.log(
		`Full report written to ${REPORT_PATH} — not applied to cms-results.json or the DB.`,
	);
}

main();
