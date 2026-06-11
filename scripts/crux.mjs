// scripts/crux.mjs
// 2026-06-10T00:00:00Z
//
// CrUX — Chrome UX Report API fetch for all confirmed Astro sites.
//
// Fetches 28-day real-user field data (LCP, CLS, INP, FCP, TTFB) at origin level.
// Low-traffic sites return no data — recorded as status "no-data".
//
// Reads confirmed Astro sites from .scan-history.db (latest scan).
// Writes crux_runs + crux_results to the same DB.
//
// Requires CRUX_API_KEY in .env
//
// Usage:
//   node scripts/crux.mjs
//   node scripts/crux.mjs --form-factor=PHONE   # PHONE | DESKTOP | TABLET (default: all 3)
//   node scripts/crux.mjs --new-only            # skip origins already fetched today
//   node scripts/crux.mjs --limit=100           # cap number of sites (for testing)
//   node scripts/crux.mjs --dry-run

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../.scan-history.db");
const ENV_PATH = resolve(__dirname, "../.env");

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
	const entry = args.find((a) => a.startsWith(`${name}=`));
	return entry ? entry.slice(name.length + 1) : null;
}

const formFactorFilter = getArg("--form-factor");
const limitArg = getArg("--limit");
const dryRun = args.includes("--dry-run");
const newOnly = args.includes("--new-only");
const DELAY_MS = 500; // CrUX quota is 150 req/min — 500ms = 120/min

// ── .env loader ───────────────────────────────────────────────────────────────

function loadEnv() {
	try {
		const lines = readFileSync(ENV_PATH, "utf8").split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const val = trimmed
				.slice(eq + 1)
				.trim()
				.replace(/^['"]|['"]$/g, "");
			process.env[key] ??= val;
		}
	} catch {
		// .env not found — API_KEY check below will catch it
	}
}

loadEnv();
const API_KEY = process.env.CRUX_API_KEY;

if (!API_KEY && !dryRun) {
	console.error("\n  CRUX_API_KEY not set in .env\n");
	process.exit(1);
}

// ── DB ────────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
	CREATE TABLE IF NOT EXISTS crux_runs (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		started_at  TEXT    NOT NULL,
		finished_at TEXT,
		duration_ms INTEGER,
		scan_id     INTEGER REFERENCES scans(id)
	);

	CREATE TABLE IF NOT EXISTS crux_results (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id      INTEGER NOT NULL REFERENCES crux_runs(id),
		site_id     INTEGER NOT NULL REFERENCES sites(id),
		fetched_at  TEXT    NOT NULL,
		form_factor TEXT    NOT NULL,
		status      TEXT    NOT NULL,
		lcp_p75     REAL,
		cls_p75     REAL,
		inp_p75     REAL,
		fcp_p75     REAL,
		ttfb_p75    REAL,
		lcp_rating  TEXT,
		cls_rating  TEXT,
		inp_rating  TEXT,
		fcp_rating  TEXT,
		ttfb_rating TEXT,
		cwv_pass    INTEGER,
		error       TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_crux_results_site ON crux_results(site_id);
	CREATE INDEX IF NOT EXISTS idx_crux_results_run  ON crux_results(run_id);
`);

// Add duration columns to existing DBs (ALTER TABLE has no IF NOT EXISTS in SQLite)
for (const col of ["finished_at TEXT", "duration_ms INTEGER"]) {
	try {
		db.exec(`ALTER TABLE crux_runs ADD COLUMN ${col}`);
	} catch {
		/* already exists */
	}
}

function loadLatestScan() {
	return db.prepare("SELECT id FROM scans ORDER BY id DESC LIMIT 1").get();
}

function loadSites(scanId, limit) {
	let query = `
		SELECT s.id, s.url, s.hostname
		FROM scan_results sr
		JOIN sites s ON s.id = sr.site_id
		WHERE sr.scan_id = ?
		  AND sr.astro_detected = 1
		ORDER BY s.hostname
	`;
	if (limit) query += ` LIMIT ${Number(limit)}`;
	return db.prepare(query).all(scanId);
}

function insertRun(startedAt, scanId) {
	return db
		.prepare("INSERT INTO crux_runs (started_at, scan_id) VALUES (?, ?)")
		.run(startedAt, scanId).lastInsertRowid;
}

const finishRun = db.prepare(
	"UPDATE crux_runs SET finished_at = ?, duration_ms = ? WHERE id = ?",
);

const insertResult = db.prepare(`
	INSERT INTO crux_results (
		run_id, site_id, fetched_at, form_factor, status,
		lcp_p75, cls_p75, inp_p75, fcp_p75, ttfb_p75,
		lcp_rating, cls_rating, inp_rating, fcp_rating, ttfb_rating,
		cwv_pass, error
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ── CrUX parser ───────────────────────────────────────────────────────────────

const METRIC_KEYS = {
	lcp: "largest_contentful_paint",
	cls: "cumulative_layout_shift",
	inp: "interaction_to_next_paint",
	fcp: "first_contentful_paint",
	ttfb: "experimental_time_to_first_byte",
};

function p75(metrics, key) {
	const val = metrics?.[key]?.percentiles?.p75 ?? null;
	return val != null ? Number(val) : null;
}

// Rates based on share of users with good/poor experience at the origin level.
// good ≥75% of users in "good" bucket; poor ≥25% in "poor" bucket; else needs-improvement.
function rating(metrics, key) {
	const hist = metrics?.[key]?.histogram;
	if (!hist?.[0]) return null;
	if (hist[0].density >= 0.75) return "good";
	if ((hist[2]?.density ?? 0) >= 0.25) return "poor";
	return "needs-improvement";
}

function parseCrux(json) {
	const metrics = json.record?.metrics;
	if (!metrics) return null;

	const lcpRating = rating(metrics, METRIC_KEYS.lcp);
	const clsRating = rating(metrics, METRIC_KEYS.cls);
	const inpRating = rating(metrics, METRIC_KEYS.inp);
	const fcpRating = rating(metrics, METRIC_KEYS.fcp);
	const ttfbRating = rating(metrics, METRIC_KEYS.ttfb);

	return {
		lcp_p75: p75(metrics, METRIC_KEYS.lcp),
		cls_p75: p75(metrics, METRIC_KEYS.cls),
		inp_p75: p75(metrics, METRIC_KEYS.inp),
		fcp_p75: p75(metrics, METRIC_KEYS.fcp),
		ttfb_p75: p75(metrics, METRIC_KEYS.ttfb),
		lcp_rating: lcpRating,
		cls_rating: clsRating,
		inp_rating: inpRating,
		fcp_rating: fcpRating,
		ttfb_rating: ttfbRating,
		cwv_pass:
			lcpRating === "good" && clsRating === "good" && inpRating === "good"
				? 1
				: 0,
	};
}

function delay(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

const latestScan = loadLatestScan();
if (!latestScan) {
	console.error("\n  No scans in DB — run pnpm detect first\n");
	process.exit(1);
}

const sites = loadSites(latestScan.id, limitArg);
const formFactors = formFactorFilter
	? [formFactorFilter]
	: ["PHONE", "DESKTOP", "TABLET"];

// --new-only: skip site_id × form_factor combos already fetched today
let jobs;
if (newOnly) {
	const today = new Date().toISOString().slice(0, 10);
	const existing = db
		.prepare(
			"SELECT DISTINCT site_id, form_factor FROM crux_results WHERE fetched_at >= ?",
		)
		.all(`${today}T00:00:00.000Z`);
	const done = new Set(existing.map((r) => `${r.site_id}:${r.form_factor}`));
	jobs = [];
	for (const site of sites) {
		for (const ff of formFactors) {
			if (!done.has(`${site.id}:${ff}`)) {
				jobs.push({ site, formFactor: ff });
			}
		}
	}
} else {
	jobs = sites.flatMap((site) =>
		formFactors.map((formFactor) => ({ site, formFactor })),
	);
}

const skipped = sites.length * formFactors.length - jobs.length;

console.log(`\nAstro CMS Detector — Chrome UX Report`);
console.log("=".repeat(60));
console.log(`  Scan:        #${latestScan.id}`);
console.log(`  Sites:       ${sites.length} confirmed Astro`);
console.log(`  Form factors: ${formFactors.join(", ")}`);
console.log(
	`  Total jobs:  ${jobs.length}${newOnly && skipped ? ` (${skipped} already fetched today, skipped)` : ""}`,
);
console.log(
	`  Est. time:   ~${Math.round((jobs.length * (DELAY_MS / 1000)) / 60)} min`,
);
console.log(
	`  Mode:        ${dryRun ? "DRY RUN" : newOnly ? "NEW ONLY" : "APPLY"}\n`,
);

if (dryRun) {
	for (const { site, formFactor } of jobs.slice(0, 20)) {
		console.log(`  ${site.hostname.padEnd(45)} ${formFactor}`);
	}
	if (jobs.length > 20) console.log(`  … and ${jobs.length - 20} more`);
	process.exit(0);
}

const startTime = Date.now();
const startedAt = new Date(startTime).toISOString();
const runId = insertRun(startedAt, latestScan.id);
let success = 0,
	noData = 0,
	errors = 0;

for (let i = 0; i < jobs.length; i++) {
	const { site, formFactor } = jobs[i];
	const progress = `[${String(i + 1).padStart(String(jobs.length).length)}/${jobs.length}]`;
	const label = `${site.hostname.padEnd(45)} ${formFactor.padEnd(8)}`;
	process.stdout.write(`  ${progress} ${label} `);

	const fetchedAt = new Date().toISOString();

	async function fetchCrux(origin) {
		return fetch(
			`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${API_KEY}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ origin, formFactor }),
			},
		);
	}

	try {
		// Try bare domain first; on 404 retry with www. prefix
		let res = await fetchCrux(`https://${site.hostname}`);

		if (res.status === 404 && !site.hostname.startsWith("www.")) {
			await delay(DELAY_MS);
			res = await fetchCrux(`https://www.${site.hostname}`);
		}

		if (res.status === 404) {
			insertResult.run(
				runId,
				site.id,
				fetchedAt,
				formFactor,
				"no-data",
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
			);
			console.log("no data");
			noData++;
			await delay(DELAY_MS);
			continue;
		}

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const json = await res.json();
		const parsed = parseCrux(json);

		if (!parsed) {
			insertResult.run(
				runId,
				site.id,
				fetchedAt,
				formFactor,
				"no-data",
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
			);
			console.log("no data");
			noData++;
		} else {
			insertResult.run(
				runId,
				site.id,
				fetchedAt,
				formFactor,
				"success",
				parsed.lcp_p75,
				parsed.cls_p75,
				parsed.inp_p75,
				parsed.fcp_p75,
				parsed.ttfb_p75,
				parsed.lcp_rating,
				parsed.cls_rating,
				parsed.inp_rating,
				parsed.fcp_rating,
				parsed.ttfb_rating,
				parsed.cwv_pass,
				null,
			);
			const lcp =
				parsed.lcp_p75 != null ? `${(parsed.lcp_p75 / 1000).toFixed(1)}s` : "—";
			const cls = parsed.cls_p75 != null ? parsed.cls_p75.toFixed(3) : "—";
			const inp = parsed.inp_p75 != null ? `${parsed.inp_p75}ms` : "—";
			const cwv = parsed.cwv_pass ? "✓ CWV" : "✗ CWV";
			console.log(`LCP ${lcp}  CLS ${cls}  INP ${inp}  ${cwv}`);
			success++;
		}
	} catch (err) {
		const msg = err.message.slice(0, 80);
		insertResult.run(
			runId,
			site.id,
			fetchedAt,
			formFactor,
			"error",
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			msg,
		);
		console.log(`ERROR: ${msg}`);
		errors++;
	}

	await delay(DELAY_MS);
}

const finishedAt = new Date().toISOString();
const durationMs = Date.now() - startTime;
const durationMin = (durationMs / 60000).toFixed(1);
finishRun.run(finishedAt, durationMs, runId);

console.log(`\n✅ CrUX complete — run_id=${runId}`);
console.log(
	`   With data: ${success}  No data: ${noData}  Errors: ${errors}  Duration: ${durationMin} min\n`,
);
db.close();
