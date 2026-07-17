// scripts/psi.mjs
// 2026-06-10T00:00:00Z
//
// PageSpeed Insights — fetch Lighthouse scores for all confirmed Astro sites.
//
// Reads confirmed Astro sites from .scan-history.db (latest scan).
// Writes psi_runs + psi_results to the same DB.
//
// Requires PAGESPEED_API_KEY in .env
//
// Usage:
//   node scripts/psi.mjs
//   node scripts/psi.mjs --strategy=mobile     # mobile | desktop (default: both)
//   node scripts/psi.mjs --new-only            # skip sites already in psi_results (success or error)
//   node scripts/psi.mjs --errors-only         # retry only site × strategy combos that previously errored
//   node scripts/psi.mjs --limit=100           # cap number of sites (for testing)
//   node scripts/psi.mjs --url=https://example.com/   # run a single site only
//   node scripts/psi.mjs --concurrency=3       # workers per strategy lane (default: 2 — 4 total for both strategies)
//   node scripts/psi.mjs --dry-run

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

const strategyFilter = getArg("--strategy");
const limitArg = getArg("--limit");
const urlFilter = getArg("--url");
const concurrencyArg = getArg("--concurrency");
const dryRun = args.includes("--dry-run");
const newOnly = args.includes("--new-only");
const errorsOnly = args.includes("--errors-only");
const DELAY_MS = 700;
// Workers per strategy lane — default 2, so both strategies together run
// 4 requests concurrently (2 mobile + 2 desktop).
const WORKERS_PER_STRATEGY = concurrencyArg ? Number(concurrencyArg) : 2;

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
const API_KEY = process.env.PAGESPEED_API_KEY;

if (!API_KEY && !dryRun) {
	console.error("\n  PAGESPEED_API_KEY not set in .env\n");
	process.exit(1);
}

// ── DB ────────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
	CREATE TABLE IF NOT EXISTS psi_runs (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		started_at  TEXT    NOT NULL,
		finished_at TEXT,
		duration_ms INTEGER,
		scan_id     INTEGER REFERENCES scans(id)
	);

	CREATE TABLE IF NOT EXISTS psi_results (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id         INTEGER NOT NULL REFERENCES psi_runs(id),
		site_id        INTEGER NOT NULL REFERENCES sites(id),
		fetched_at     TEXT    NOT NULL,
		strategy       TEXT    NOT NULL,
		status         TEXT    NOT NULL,
		performance    INTEGER,
		accessibility  INTEGER,
		best_practices INTEGER,
		seo            INTEGER,
		agentic_score      INTEGER,
		agentic_passed     INTEGER,
		agentic_applicable INTEGER,
		cwv_category   TEXT,
		lab_lcp        TEXT,
		lab_cls        TEXT,
		lab_tbt        TEXT,
		field_lcp      INTEGER,
		field_inp      INTEGER,
		field_cls      REAL,
		field_lcp_cat  TEXT,
		field_inp_cat  TEXT,
		field_cls_cat  TEXT,
		error          TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_psi_results_site ON psi_results(site_id);
	CREATE INDEX IF NOT EXISTS idx_psi_results_run  ON psi_results(run_id);
`);

// Add duration columns to existing DBs (ALTER TABLE has no IF NOT EXISTS in SQLite)
for (const col of ["finished_at TEXT", "duration_ms INTEGER"]) {
	try {
		db.exec(`ALTER TABLE psi_runs ADD COLUMN ${col}`);
	} catch {
		/* already exists */
	}
}

// Add Agentic Browsing columns to existing DBs
for (const col of [
	"agentic_score INTEGER",
	"agentic_passed INTEGER",
	"agentic_applicable INTEGER",
]) {
	try {
		db.exec(`ALTER TABLE psi_results ADD COLUMN ${col}`);
	} catch {
		/* already exists */
	}
}

function loadLatestScan() {
	return db.prepare("SELECT id FROM scans ORDER BY id DESC LIMIT 1").get();
}

function loadSites(scanId, limit, urlFilter) {
	if (urlFilter) {
		// Single-site lookup — bypass the astro_detected filter so this also
		// works for a manual one-off check on a site not in the latest scan.
		const row = db
			.prepare("SELECT id, url, hostname FROM sites WHERE url = ? OR url = ?")
			.get(urlFilter, urlFilter.replace(/\/$/, ""));
		return row ? [row] : [];
	}
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
		.prepare("INSERT INTO psi_runs (started_at, scan_id) VALUES (?, ?)")
		.run(startedAt, scanId).lastInsertRowid;
}

const finishRun = db.prepare(
	"UPDATE psi_runs SET finished_at = ?, duration_ms = ? WHERE id = ?",
);

const insertResult = db.prepare(`
	INSERT INTO psi_results (
		run_id, site_id, fetched_at, strategy, status,
		performance, accessibility, best_practices, seo,
		agentic_score, agentic_passed, agentic_applicable,
		cwv_category, lab_lcp, lab_cls, lab_tbt,
		field_lcp, field_inp, field_cls,
		field_lcp_cat, field_inp_cat, field_cls_cat,
		error
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ── PSI parser ────────────────────────────────────────────────────────────────

function score(cats, id) {
	const s = cats?.[id]?.score;
	return s != null ? Math.round(s * 100) : null;
}

function metric(audits, id) {
	return audits?.[id]?.displayValue ?? null;
}

// PSI's own UI shows Agentic Browsing as "passed/applicable" (e.g. "3/3", "1/3")
// rather than a 0-100 score — most of its audits (WebMCP tools, llms.txt) are
// notApplicable unless the site actually implements that feature, so a
// percentage would be misleading. "Passed" follows Lighthouse's own green/red
// threshold (score >= 0.9), same as the checkmarks in a Lighthouse report.
function agenticBrowsing(cats, audits) {
	const cat = cats?.["agentic-browsing"];
	if (!cat) return { score: null, passed: null, applicable: null };
	let passed = 0;
	let applicable = 0;
	for (const ref of cat.auditRefs) {
		const a = audits?.[ref.id];
		if (!a || a.scoreDisplayMode === "notApplicable") continue;
		applicable++;
		if (a.score != null && a.score >= 0.9) passed++;
	}
	return {
		score: cat.score != null ? Math.round(cat.score * 100) : null,
		passed,
		applicable,
	};
}

// fallow-ignore-next-line complexity
function parsePsi(json) {
	const lh = json.lighthouseResult;
	const cats = lh?.categories;
	const audits = lh?.audits;
	const cwvMet = json.loadingExperience?.metrics;
	const cwvCat = json.loadingExperience?.overall_category ?? null;
	const agentic = agenticBrowsing(cats, audits);

	return {
		status: "success",
		performance: score(cats, "performance"),
		accessibility: score(cats, "accessibility"),
		bestPractices: score(cats, "best-practices"),
		seo: score(cats, "seo"),
		agenticScore: agentic.score,
		agenticPassed: agentic.passed,
		agenticApplicable: agentic.applicable,
		cwvCategory: cwvCat,
		labLcp: metric(audits, "largest-contentful-paint"),
		labCls: metric(audits, "cumulative-layout-shift"),
		labTbt: metric(audits, "total-blocking-time"),
		fieldLcp: cwvMet?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
		fieldInp: cwvMet?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
		fieldCls: cwvMet?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? null,
		fieldLcpCat: cwvMet?.LARGEST_CONTENTFUL_PAINT_MS?.category ?? null,
		fieldInpCat: cwvMet?.INTERACTION_TO_NEXT_PAINT?.category ?? null,
		fieldClsCat: cwvMet?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category ?? null,
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

const sites = loadSites(latestScan.id, limitArg, urlFilter);
if (urlFilter && sites.length === 0) {
	console.error(`\n  No site found in DB matching --url=${urlFilter}\n`);
	process.exit(1);
}
const strategies = strategyFilter ? [strategyFilter] : ["mobile", "desktop"];

// --new-only: skip site_id × strategy combos already in psi_results (success or error)
// --errors-only: retry only site_id × strategy combos that previously errored
let jobs;
if (errorsOnly) {
	const errored = db
		.prepare(
			`SELECT DISTINCT site_id, strategy FROM psi_results WHERE status = 'error'
       EXCEPT
       SELECT DISTINCT site_id, strategy FROM psi_results WHERE status = 'success'`,
		)
		.all();
	const retry = new Set(errored.map((r) => `${r.site_id}:${r.strategy}`));
	jobs = [];
	for (const site of sites) {
		for (const strategy of strategies) {
			if (retry.has(`${site.id}:${strategy}`)) {
				jobs.push({ site, strategy });
			}
		}
	}
} else if (newOnly) {
	const existing = db
		.prepare("SELECT DISTINCT site_id, strategy FROM psi_results")
		.all();
	const done = new Set(existing.map((r) => `${r.site_id}:${r.strategy}`));
	jobs = [];
	for (const site of sites) {
		for (const strategy of strategies) {
			if (!done.has(`${site.id}:${strategy}`)) {
				jobs.push({ site, strategy });
			}
		}
	}
} else {
	jobs = sites.flatMap((site) =>
		strategies.map((strategy) => ({ site, strategy })),
	);
}

const skipped = sites.length * strategies.length - jobs.length;

// One queue per strategy — WORKERS_PER_STRATEGY concurrent workers each pull
// from their own queue, so mobile and desktop always run in parallel rather
// than one strategy's workers sitting idle once the other queue empties.
const queues = new Map(strategies.map((s) => [s, []]));
for (const job of jobs) queues.get(job.strategy).push(job);
const totalWorkers = strategies.length * WORKERS_PER_STRATEGY;
const maxQueueLen = Math.max(...[...queues.values()].map((q) => q.length));

console.log(`\nAstro CMS Detector — PageSpeed Insights`);
console.log("=".repeat(60));
console.log(`  Scan:        #${latestScan.id}`);
console.log(`  Sites:       ${sites.length} confirmed Astro`);
console.log(`  Strategies:  ${strategies.join(", ")}`);
console.log(
	`  Concurrency: ${WORKERS_PER_STRATEGY} workers × ${strategies.length} strategies = ${totalWorkers} total`,
);
console.log(
	`  Total jobs:  ${jobs.length}${newOnly && skipped ? ` (${skipped} already tested, skipped)` : ""}`,
);
// ~22s per job observed (PSI runs Lighthouse remotely — a request blocks for
// the full remote run, so concurrency shortens wall time, not a smaller delay)
const EST_SECS_PER_JOB = 22;
console.log(
	`  Est. time:   ~${Math.round((Math.ceil(maxQueueLen / WORKERS_PER_STRATEGY) * EST_SECS_PER_JOB) / 60)} min`,
);
console.log(
	`  Mode:        ${dryRun ? "DRY RUN" : errorsOnly ? "ERRORS ONLY" : newOnly ? "NEW ONLY" : "APPLY"}\n`,
);

if (dryRun) {
	for (const { site, strategy } of jobs.slice(0, 20)) {
		console.log(`  ${site.hostname.padEnd(45)} ${strategy}`);
	}
	if (jobs.length > 20) console.log(`  … and ${jobs.length - 20} more`);
	process.exit(0);
}

const startTime = Date.now();
const startedAt = new Date(startTime).toISOString();
const runId = insertRun(startedAt, latestScan.id);
let success = 0,
	errors = 0,
	completed = 0;
const totalDigits = String(jobs.length).length;

// better-sqlite3 is synchronous and Node is single-threaded, so concurrent
// workers interleave via async I/O (the fetch) but never race on the shared
// `insertResult` statement — each .run() call completes atomically before
// the next worker gets a turn.
async function runJob({ site, strategy }) {
	const progress = `[${String(++completed).padStart(totalDigits)}/${jobs.length}]`;
	const label = `${site.hostname.padEnd(45)} ${strategy.padEnd(8)}`;
	const fetchedAt = new Date().toISOString();

	try {
		const qs =
			`url=${encodeURIComponent(site.url)}&strategy=${strategy}&key=${API_KEY}` +
			`&category=performance&category=accessibility&category=best-practices&category=seo&category=agentic-browsing`;
		const res = await fetch(
			`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`,
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const json = await res.json();
		const data = parsePsi(json);

		insertResult.run(
			runId,
			site.id,
			fetchedAt,
			strategy,
			data.status,
			data.performance,
			data.accessibility,
			data.bestPractices,
			data.seo,
			data.agenticScore,
			data.agenticPassed,
			data.agenticApplicable,
			data.cwvCategory,
			data.labLcp,
			data.labCls,
			data.labTbt,
			data.fieldLcp,
			data.fieldInp,
			data.fieldCls,
			data.fieldLcpCat,
			data.fieldInpCat,
			data.fieldClsCat,
			null,
		);
		const agenticStr =
			data.agenticApplicable != null
				? `${data.agenticPassed}/${data.agenticApplicable}`
				: "—";
		console.log(
			`  ${progress} ${label} Perf: ${String(data.performance ?? "—").padStart(3)}  ` +
				`A11y: ${String(data.accessibility ?? "—").padStart(3)}  ` +
				`SEO: ${String(data.seo ?? "—").padStart(3)}  ` +
				`Agentic: ${agenticStr.padStart(3)}  ` +
				`CWV: ${data.cwvCategory ?? "—"}`,
		);
		success++;
	} catch (err) {
		const msg = err.message.slice(0, 80);
		console.log(`  ${progress} ${label} ERROR: ${msg}`);
		insertResult.run(
			runId,
			site.id,
			fetchedAt,
			strategy,
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
			null,
			null,
			null,
			null,
			null,
			null,
			msg,
		);
		errors++;
	}

	await delay(DELAY_MS);
}

async function runQueue(queue) {
	let job = queue.shift();
	while (job) {
		await runJob(job);
		job = queue.shift();
	}
}

const workers = [];
for (const queue of queues.values()) {
	for (let i = 0; i < WORKERS_PER_STRATEGY; i++) {
		workers.push(runQueue(queue));
	}
}
await Promise.all(workers);

const finishedAt = new Date().toISOString();
const durationMs = Date.now() - startTime;
const durationMin = (durationMs / 60000).toFixed(1);
finishRun.run(finishedAt, durationMs, runId);

console.log(`\n✅ PSI complete — run_id=${runId}`);
console.log(
	`   Success: ${success}  Errors: ${errors}  Duration: ${durationMin} min\n`,
);
db.close();
