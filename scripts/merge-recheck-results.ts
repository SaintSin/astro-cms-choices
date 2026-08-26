// scripts/merge-recheck-results.ts
//
// Applies the `changed` entries from blocked-recheck-report.json (produced
// by recheck-blocked.ts) onto both src/data/cms-results.json and the
// scan-history DB's current latest scan — without touching any other site,
// and without re-running a full pnpm detect.
//
// Dry-run by default: prints exactly what would change and writes nothing.
// Pass --apply to actually write.
//
// Usage:
//   node --experimental-strip-types scripts/merge-recheck-results.ts
//   node --experimental-strip-types scripts/merge-recheck-results.ts -- --apply

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { openDb } from "./db-utils.ts";
import type { CmsResult, ResultsFile } from "./detect-cms.ts";

const { values: args } = parseArgs({
	options: { apply: { type: "boolean", default: false } },
});
const APPLY = args.apply === true;

const RESULTS_PATH = resolve("src/data/cms-results.json");
const REPORT_PATH = resolve("blocked-recheck-report.json");

interface RecheckOutcome {
	url: string;
	title: string;
	before: { cms: string; cmsType: string; astroDetected: boolean };
	after: { cms: string; cmsType: string; astroDetected: boolean };
	changed: boolean;
	error?: string;
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

interface Report {
	generated: string;
	changed: RecheckOutcome[];
}

async function main() {
	const report: Report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
	const data: ResultsFile = JSON.parse(await readFile(RESULTS_PATH, "utf8"));

	const applicable = report.changed.filter((o) => o.fullResult);
	if (applicable.length === 0) {
		console.log("Nothing to merge — no `changed` entries with full results.");
		return;
	}

	console.log(
		`${APPLY ? "Applying" : "Dry run —"} ${applicable.length} reclassification(s) from ${REPORT_PATH}\n`,
	);

	const byUrl = new Map(data.results.map((r) => [r.url, r]));
	const updated: { url: string; before: string; after: string }[] = [];

	for (const outcome of applicable) {
		const existing = byUrl.get(outcome.url);
		if (!existing) {
			console.log(`  ⚠ skipped (not in cms-results.json): ${outcome.url}`);
			continue;
		}
		const full = outcome.fullResult;
		if (!full) continue;

		updated.push({
			url: outcome.url,
			before: `${existing.cms} (astroDetected: ${existing.astroDetected})`,
			after: `${full.cms} (astroDetected: ${full.astroDetected})`,
		});

		Object.assign(existing, full);
	}

	for (const u of updated) {
		console.log(`  ${u.url}\n    ${u.before} → ${u.after}`);
	}
	console.log(
		`\n${updated.length} site(s) ${APPLY ? "updated" : "would be updated"}.`,
	);

	if (!APPLY) {
		console.log(
			"\nDry run only — nothing written. Re-run with --apply to write.",
		);
		return;
	}

	data.generated = new Date().toISOString();
	await writeFile(RESULTS_PATH, JSON.stringify(data, null, 2));
	console.log(`Wrote ${RESULTS_PATH}`);

	// ── Mirror the same updates into the DB's current latest scan ──────────
	const db = openDb();
	try {
		const latestScan = db
			.prepare("SELECT id FROM scans ORDER BY id DESC LIMIT 1")
			.get() as { id: number } | undefined;
		if (!latestScan) {
			console.log("No scans in DB — skipping DB update.");
			return;
		}

		const getSiteId = db.prepare<[string], { id: number }>(
			"SELECT id FROM sites WHERE url = ?",
		);
		const updateResult = db.prepare(`
      UPDATE scan_results
      SET cms = ?, cms_type = ?, confidence = ?, astro_detected = ?,
          astro_version = ?, starlight_version = ?, astro_signals = ?,
          evidence = ?, final_url = ?, fetched_at = ?
      WHERE scan_id = ? AND site_id = ?
    `);

		const writeAll = db.transaction(() => {
			for (const outcome of applicable) {
				const full = outcome.fullResult;
				if (!full) continue;
				const site = getSiteId.get(outcome.url);
				if (!site) continue;
				updateResult.run(
					full.cms,
					full.cmsType,
					full.confidence || null,
					full.astroDetected ? 1 : 0,
					full.astroVersion || null,
					full.starlightVersion || null,
					JSON.stringify(full.astroSignals),
					JSON.stringify(full.evidence ?? []),
					full.finalUrl || null,
					full.fetchedAt,
					latestScan.id,
					site.id,
				);
			}

			// Recompute this scan's aggregate counts — they're now stale since
			// some rows within it just changed classification.
			const counts = db
				.prepare(
					`SELECT
             SUM(astro_detected) AS astro_confirmed,
             SUM(CASE WHEN cms = 'Error' THEN 1 ELSE 0 END) AS errors,
             SUM(CASE WHEN cms = 'Blocked' THEN 1 ELSE 0 END) AS blocked,
             SUM(CASE WHEN cms = 'Forwarded' THEN 1 ELSE 0 END) AS forwarded
           FROM scan_results WHERE scan_id = ?`,
				)
				.get(latestScan.id) as {
				astro_confirmed: number;
				errors: number;
				blocked: number;
				forwarded: number;
			};
			db.prepare(
				"UPDATE scans SET astro_confirmed = ?, errors = ?, blocked = ?, forwarded = ? WHERE id = ?",
			).run(
				counts.astro_confirmed,
				counts.errors,
				counts.blocked,
				counts.forwarded,
				latestScan.id,
			);
		});
		writeAll();
		console.log(
			`DB: scan #${latestScan.id} updated and aggregate counts recomputed.`,
		);
	} finally {
		db.close();
	}
}

main();
