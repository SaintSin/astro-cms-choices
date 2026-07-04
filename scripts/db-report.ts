// scripts/db-report.ts
// 2026-05-27T00:00:00Z
//
// Query the scan-history DB and print reports to stdout.
//
// Usage:
//   pnpm db:report                        — recent scan summary (default)
//   pnpm db:report -- --errors            — sites erroring in 3+ of last 5 scans
//   pnpm db:report -- --errors --scans 8  — same, last 8 scans
//   pnpm db:report -- --errors --min 5    — raise threshold to 5 consecutive errors
//   pnpm db:report -- --changes           — CMS / Astro changes between last 2 scans
//   pnpm db:report -- --site example.com  — full history for one hostname
//   pnpm db:report -- --decay             — Astro sites still on v4 or older
//   pnpm db:report -- --lost-astro        — sites that migrated away from Astro, with PSI before/after
//   pnpm db:report -- --all               — run every report

import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { DB_PATH, openDb } from "./db-utils.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hr(char = "─", width = 60): string {
	return char.repeat(width);
}

function pad(s: string | number, n: number): string {
	return String(s).padEnd(n);
}

function lpad(s: string | number, n: number): string {
	return String(s).padStart(n);
}

function fmtDate(iso: string): string {
	return new Date(iso).toLocaleString("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function reportSummary(db: ReturnType<typeof openDb>): void {
	console.log(`\n${hr()}`);
	console.log("  SCAN HISTORY — last 10 runs");
	console.log(hr());

	type ScanRow = {
		id: number;
		scanned_at: string;
		total_sites: number;
		astro_confirmed: number;
		errors: number;
		blocked: number;
		forwarded: number;
		duration_ms: number | null;
	};

	const scans = db
		.prepare<[], ScanRow>(
			`SELECT id, scanned_at, total_sites, astro_confirmed, errors, blocked, forwarded, duration_ms
       FROM scans ORDER BY id DESC LIMIT 10`,
		)
		.all();

	if (scans.length === 0) {
		console.log("  No scans recorded yet. Run 'pnpm detect' first.");
		return;
	}

	console.log(
		`  ${pad("#", 4)} ${pad("Date", 22)} ${lpad("Total", 6)} ${lpad("Astro", 6)} ${lpad("Errors", 7)} ${lpad("Blocked", 8)} ${lpad("Fwded", 6)} ${lpad("Dur.", 7)}`,
	);
	console.log(`  ${hr("·", 72)}`);

	for (const s of scans) {
		const dur = s.duration_ms ? `${Math.round(s.duration_ms / 1000)}s` : "—";
		console.log(
			`  ${pad(s.id, 4)} ${pad(fmtDate(s.scanned_at), 22)} ${lpad(s.total_sites, 6)} ${lpad(s.astro_confirmed, 6)} ${lpad(s.errors, 7)} ${lpad(s.blocked, 8)} ${lpad(s.forwarded, 6)} ${lpad(dur, 7)}`,
		);
	}
}

function reportErrors(
	db: ReturnType<typeof openDb>,
	lastN: number,
	minErrors: number,
): void {
	console.log(`\n${hr()}`);
	console.log(
		`  CONSISTENTLY DOWN — errored in ${minErrors}+ of last ${lastN} scans`,
	);
	console.log(hr());

	type ErrorRow = {
		hostname: string;
		url: string;
		error_count: number;
		total_scans: number;
		last_error: string;
		last_checked: string;
	};

	const rows = db
		.prepare<[number, number], ErrorRow>(
			`WITH recent AS (
        SELECT id FROM scans ORDER BY id DESC LIMIT ?
      ),
      counts AS (
        SELECT
          s.id        AS site_id,
          s.hostname,
          s.url,
          COUNT(*)    AS error_count,
          (SELECT COUNT(*) FROM recent) AS total_scans,
          MAX(sr.error_message) AS last_error,
          MAX(sc.scanned_at)   AS last_checked
        FROM scan_results sr
        JOIN sites  s  ON s.id  = sr.site_id
        JOIN scans  sc ON sc.id = sr.scan_id
        JOIN recent r  ON r.id  = sr.scan_id
        WHERE sr.cms = 'Error'
        GROUP BY s.id
      )
      SELECT hostname, url, error_count, total_scans, last_error, last_checked
      FROM counts
      WHERE error_count >= ?
      ORDER BY error_count DESC, hostname`,
		)
		.all(lastN, minErrors);

	if (rows.length === 0) {
		console.log(
			`  ✓ No sites errored ${minErrors}+ times in the last ${lastN} scans.`,
		);
		return;
	}

	console.log(`  ${rows.length} site(s) consistently unreachable:\n`);

	for (const r of rows) {
		const rate = `${r.error_count}/${r.total_scans}`;
		console.log(`  ${r.hostname.padEnd(40)} ${rate.padStart(5)} errors`);
		console.log(`    URL   : ${r.url}`);
		if (r.last_error) {
			const msg = r.last_error.slice(0, 80);
			console.log(`    Reason: ${msg}`);
		}
		console.log(`    Last  : ${fmtDate(r.last_checked)}\n`);
	}
}

function reportChanges(db: ReturnType<typeof openDb>): void {
	console.log(`\n${hr()}`);
	console.log("  CHANGES — latest scan vs previous");
	console.log(hr());

	type ScanMeta = { id: number; scanned_at: string };
	const [latest, previous] = db
		.prepare<[], ScanMeta>(
			"SELECT id, scanned_at FROM scans ORDER BY id DESC LIMIT 2",
		)
		.all();

	if (!previous) {
		console.log("  Need at least 2 scans to compare.");
		return;
	}

	console.log(`  Comparing scan #${latest.id} (${fmtDate(latest.scanned_at)})`);
	console.log(
		`       with scan #${previous.id} (${fmtDate(previous.scanned_at)})\n`,
	);

	type ChangeRow = {
		hostname: string;
		url: string;
		prev_cms: string;
		curr_cms: string;
		prev_astro: number;
		curr_astro: number;
		prev_ver: string | null;
		curr_ver: string | null;
	};

	const changes = db
		.prepare<[number, number], ChangeRow>(
			`SELECT
        s.hostname,
        s.url,
        prev.cms          AS prev_cms,
        curr.cms          AS curr_cms,
        prev.astro_detected AS prev_astro,
        curr.astro_detected AS curr_astro,
        prev.astro_version  AS prev_ver,
        curr.astro_version  AS curr_ver
      FROM scan_results curr
      JOIN scan_results prev ON prev.site_id = curr.site_id AND prev.scan_id = ?
      JOIN sites s ON s.id = curr.site_id
      WHERE curr.scan_id = ?
        AND (curr.cms != prev.cms
             OR curr.astro_detected != prev.astro_detected
             OR curr.astro_version  != prev.astro_version)
      ORDER BY s.hostname`,
		)
		.all(previous.id, latest.id);

	if (changes.length === 0) {
		console.log("  No changes detected between these two scans.");
		return;
	}

	// Bucket changes
	const lostAstro = changes.filter((r) => r.prev_astro && !r.curr_astro);
	const gainedAstro = changes.filter((r) => !r.prev_astro && r.curr_astro);
	const versionUp = changes.filter(
		(r) => r.prev_ver && r.curr_ver && r.prev_ver !== r.curr_ver,
	);
	const cmsOnly = changes.filter(
		(r) => r.prev_cms !== r.curr_cms && r.prev_astro === r.curr_astro,
	);

	const printGroup = (
		label: string,
		rows: ChangeRow[],
		fmt: (r: ChangeRow) => string,
	) => {
		if (rows.length === 0) return;
		console.log(`  ${label} (${rows.length}):`);
		for (const r of rows) console.log(`    ${r.hostname.padEnd(38)} ${fmt(r)}`);
		console.log();
	};

	printGroup(
		"No longer Astro",
		lostAstro,
		(r) => `${r.prev_cms} → ${r.curr_cms}`,
	);
	printGroup("Newly Astro", gainedAstro, (r) => `→ v${r.curr_ver ?? "?"}`);
	printGroup(
		"Astro version changed",
		versionUp,
		(r) => `v${r.prev_ver} → v${r.curr_ver}`,
	);
	printGroup(
		"CMS label changed",
		cmsOnly,
		(r) => `${r.prev_cms} → ${r.curr_cms}`,
	);
}

function reportLostAstro(db: ReturnType<typeof openDb>): void {
	console.log(`\n${hr()}`);
	console.log("  LOST ASTRO — sites that migrated away, with PSI before/after");
	console.log(hr());

	type LostRow = {
		hostname: string;
		url: string;
		curr_cms: string;
		lost_scan_id: number;
		lost_at: string;
		last_astro_scanned_at: string;
	};

	// Latest result per site vs the last scan where it was still Astro.
	// Use the scanned_at timestamp (not scan_id) as the PSI cutoff below —
	// a psi_run's scan_id records which scan *triggered* it, not when it
	// actually fetched the page, and PSI runs can lag their scan by hours.
	const rows = db
		.prepare<[], LostRow>(
			`WITH latest AS (
        SELECT sr.* FROM scan_results sr
        JOIN (SELECT site_id, MAX(scan_id) AS max_scan FROM scan_results GROUP BY site_id) m
          ON m.site_id = sr.site_id AND m.max_scan = sr.scan_id
      ),
      last_astro AS (
        SELECT sr.site_id, sr.scan_id, sc.scanned_at
        FROM scan_results sr
        JOIN scans sc ON sc.id = sr.scan_id
        JOIN (SELECT site_id, MAX(scan_id) AS max_scan FROM scan_results WHERE astro_detected = 1 GROUP BY site_id) m
          ON m.site_id = sr.site_id AND m.max_scan = sr.scan_id
      )
      SELECT
        s.hostname, s.url,
        latest.cms       AS curr_cms,
        latest.scan_id   AS lost_scan_id,
        sc.scanned_at    AS lost_at,
        last_astro.scanned_at AS last_astro_scanned_at
      FROM latest
      JOIN last_astro ON last_astro.site_id = latest.site_id
      JOIN sites s ON s.id = latest.site_id
      JOIN scans sc ON sc.id = latest.scan_id
      WHERE latest.astro_detected = 0
        AND latest.cms NOT IN ('Error', 'Blocked')
      ORDER BY sc.scanned_at DESC`,
		)
		.all();

	if (rows.length === 0) {
		console.log("  ✓ No sites have lost Astro detection.");
		return;
	}

	console.log(
		`  ${rows.length} site(s) previously Astro, now something else:\n`,
	);

	type PsiRow = { performance: number | null; fetched_at: string };
	// Cutoff is the actual fetch timestamp, not scan_id — a PSI run can fire
	// hours after the scan that triggered it, by which point the site may
	// have already migrated off Astro.
	const psiBeforeCutoff = db.prepare<[string, string], PsiRow>(
		`SELECT pr.performance, pr.fetched_at
     FROM psi_results pr
     JOIN sites s ON s.id = pr.site_id
     WHERE s.hostname = ? AND pr.fetched_at <= ? AND pr.strategy = 'mobile'
       AND pr.performance IS NOT NULL
     ORDER BY pr.fetched_at DESC LIMIT 1`,
	);
	const psiLatest = db.prepare<[string], PsiRow>(
		`SELECT pr.performance, pr.fetched_at
     FROM psi_results pr
     JOIN sites s ON s.id = pr.site_id
     WHERE s.hostname = ? AND pr.strategy = 'mobile'
       AND pr.performance IS NOT NULL
     ORDER BY pr.fetched_at DESC LIMIT 1`,
	);

	for (const r of rows) {
		console.log(`  ${r.hostname}`);
		console.log(`    ${r.url}`);
		console.log(
			`    Astro → ${r.curr_cms}   (lost as of ${fmtDate(r.lost_at)})`,
		);

		const before = psiBeforeCutoff.get(r.hostname, r.last_astro_scanned_at);
		const after = psiLatest.get(r.hostname);

		if (before?.performance != null && after?.performance != null) {
			const delta = after.performance - before.performance;
			const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "▬";
			console.log(
				`    PSI performance: ${before.performance} → ${after.performance}  ${arrow} ${delta > 0 ? "+" : ""}${delta}`,
			);
		} else {
			console.log(
				"    PSI performance: no comparable data (run 'pnpm psi' to backfill)",
			);
		}
		console.log();
	}
}

function reportSite(db: ReturnType<typeof openDb>, hostname: string): void {
	console.log(`\n${hr()}`);
	console.log(`  HISTORY — ${hostname}`);
	console.log(hr());

	// Accept partial hostname match
	type SiteRow = { id: number; url: string; hostname: string };
	const site = db
		.prepare<[string, string], SiteRow>(
			"SELECT id, url, hostname FROM sites WHERE hostname = ? OR hostname LIKE ?",
		)
		.get(hostname, `%${hostname}%`);

	if (!site) {
		console.log(`  Site not found: ${hostname}`);
		return;
	}

	console.log(`  URL: ${site.url}\n`);

	type HistRow = {
		scanned_at: string;
		cms: string;
		astro_detected: number;
		astro_version: string | null;
		confidence: string | null;
		error_message: string | null;
	};

	const rows = db
		.prepare<[number], HistRow>(
			`SELECT sc.scanned_at, sr.cms, sr.astro_detected, sr.astro_version,
              sr.confidence, sr.error_message
       FROM scan_results sr
       JOIN scans sc ON sc.id = sr.scan_id
       WHERE sr.site_id = ?
       ORDER BY sc.scanned_at DESC`,
		)
		.all(site.id);

	if (rows.length === 0) {
		console.log("  No scan results recorded.");
		return;
	}

	console.log(
		`  ${pad("Date", 22)} ${pad("CMS", 18)} ${"Astro".padEnd(6)} ${"Version".padEnd(10)} Conf.`,
	);
	console.log(`  ${hr("·", 68)}`);

	for (const r of rows) {
		const astro = r.astro_detected ? "✓" : "✗";
		const ver = r.astro_version ?? "—";
		const conf = r.confidence ?? "—";
		const cmsStr = r.cms.padEnd(18);
		console.log(
			`  ${pad(fmtDate(r.scanned_at), 22)} ${cmsStr} ${astro.padEnd(6)} ${ver.padEnd(10)} ${conf}`,
		);
		if (r.error_message) {
			console.log(`    ↳ ${r.error_message.slice(0, 70)}`);
		}
	}
}

function reportDecay(db: ReturnType<typeof openDb>): void {
	console.log(`\n${hr()}`);
	console.log("  ASTRO VERSION DECAY — latest scan, grouped by major version");
	console.log(hr());

	type ScanId = { id: number };
	const latestScan = db
		.prepare<[], ScanId>("SELECT id FROM scans ORDER BY id DESC LIMIT 1")
		.get();

	if (!latestScan) {
		console.log("  No scans found.");
		return;
	}

	type DecayRow = {
		major: string;
		count: number;
		sample_versions: string;
	};

	const rows = db
		.prepare<[number], DecayRow>(
			`SELECT
        CASE
          WHEN astro_version IS NULL THEN 'unknown'
          ELSE substr(astro_version, 1, instr(astro_version || '.', '.') - 1)
        END AS major,
        COUNT(*) AS count,
        GROUP_CONCAT(DISTINCT astro_version) AS sample_versions
      FROM scan_results
      WHERE scan_id = ?
        AND astro_detected = 1
      GROUP BY major
      ORDER BY CAST(major AS INTEGER) DESC`,
		)
		.all(latestScan.id);

	if (rows.length === 0) {
		console.log("  No Astro sites in latest scan.");
		return;
	}

	const total = rows.reduce((s, r) => s + r.count, 0);

	for (const r of rows) {
		const label = r.major === "unknown" ? "no version" : `v${r.major}.x`;
		const pct = ((r.count / total) * 100).toFixed(1);
		const bar = "█".repeat(Math.round((r.count / total) * 30));
		console.log(
			`  ${label.padEnd(12)} ${lpad(r.count, 5)} sites  ${lpad(pct, 5)}%  ${bar}`,
		);
	}

	// Flag old versions specifically
	const old = rows.filter((r) => r.major !== "unknown" && Number(r.major) < 4);
	if (old.length > 0) {
		console.log("\n  Sites on v1–v3 (very outdated):");
		for (const r of old) {
			const versions = (r.sample_versions ?? "")
				.split(",")
				.slice(0, 5)
				.join(", ");
			console.log(`    v${r.major}.x — ${r.count} site(s)  [${versions}]`);
		}
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
	// Filter bare '--' separator (passed through by some runners)
	args: process.argv.slice(2).filter((a) => a !== "--"),
	options: {
		summary: { type: "boolean", default: false },
		errors: { type: "boolean", default: false },
		changes: { type: "boolean", default: false },
		decay: { type: "boolean", default: false },
		"lost-astro": { type: "boolean", default: false },
		all: { type: "boolean", default: false },
		site: { type: "string" },
		scans: { type: "string", default: "5" }, // look-back window for --errors
		min: { type: "string", default: "5" }, // minimum error count for --errors
	},
});

if (!existsSync(DB_PATH)) {
	console.error(`DB not found: ${DB_PATH}`);
	console.error("Run 'pnpm db:init' or 'pnpm detect' first.");
	process.exit(1);
}

const db = openDb();

const runSummary =
	args.all ||
	args.summary ||
	(!args.errors &&
		!args.changes &&
		!args.site &&
		!args.decay &&
		!args["lost-astro"]);
const runErrors = args.all || args.errors;
const runChanges = args.all || args.changes;
const runDecay = args.all || args.decay;
const runLostAstro = args.all || args["lost-astro"];
const runSite = args.site;

if (runSummary) reportSummary(db);
if (runErrors) reportErrors(db, Number(args.scans), Number(args.min));
if (runChanges) reportChanges(db);
if (runDecay) reportDecay(db);
if (runLostAstro) reportLostAstro(db);
if (runSite) reportSite(db, runSite);

db.close();
console.log(`\n${hr()}\n`);
