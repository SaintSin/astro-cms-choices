// scripts/dns-check.mjs
// 2026-06-10T00:00:00Z
//
// DNS + HTTP triage for persistently-erroring showcase sites.
//
// Queries .scan-history.db for sites that have errored in N or more of the
// last M scans, then classifies each one:
//
//   gone        — both DoH resolvers return NXDOMAIN (domain likely expired/deleted)
//   alive       — DNS resolves + HTTP HEAD returns 2xx/3xx (transient scan error)
//   broken      — DNS resolves + HTTP HEAD returns 4xx/5xx (server up, site broken)
//   dead-server — DNS resolves but connection refused / timed out
//   dns-error   — DoH lookup itself failed (network issue running this script)
//
// Usage:
//   node scripts/dns-check.mjs
//   node scripts/dns-check.mjs --scans=8       # look-back window (default: 5)
//   node scripts/dns-check.mjs --min=5         # min error count (default: 3)
//   node scripts/dns-check.mjs --concurrency=5 # parallel checks (default: 10)
//   node scripts/dns-check.mjs --limit=50      # cap sites checked (testing)
//   node scripts/dns-check.mjs --dry-run       # list sites, skip network checks

import Database from "better-sqlite3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = resolve(__dirname, "../.scan-history.db");

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, fallback) {
	const entry = args.find(a => a.startsWith(`${name}=`));
	return entry ? entry.slice(name.length + 1) : fallback;
}

const SCANS       = parseInt(getArg("--scans", "5"), 10);
const MIN_ERRORS  = parseInt(getArg("--min", "3"), 10);
const CONCURRENCY = parseInt(getArg("--concurrency", "10"), 10);
const LIMIT       = getArg("--limit") ? parseInt(getArg("--limit"), 10) : null;
const DRY_RUN     = args.includes("--dry-run");

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(s, n)  { return String(s).padEnd(n); }
function lpad(s, n) { return String(s).padStart(n); }
function hr(c = "─", w = 72) { return c.repeat(w); }

// Run `tasks` with at most `limit` in flight at once
async function pool(tasks, limit) {
	const results = [];
	let i = 0;
	async function next() {
		while (i < tasks.length) {
			const idx = i++;
			results[idx] = await tasks[idx]();
			await next();
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, next));
	return results;
}

// ── DNS over HTTPS ────────────────────────────────────────────────────────────

const DOH_PROVIDERS = [
	"https://cloudflare-dns.com/dns-query",
	"https://dns.google/resolve",
];

// Returns: 'nxdomain' | 'found' | 'error'
async function dohLookup(hostname) {
	for (const base of DOH_PROVIDERS) {
		try {
			const res = await fetch(`${base}?name=${hostname}&type=A`, {
				headers: { Accept: "application/dns-json" },
				signal: AbortSignal.timeout(5000),
			});
			if (!res.ok) continue;
			const { Status, Answer } = await res.json();
			// Status 3 = NXDOMAIN
			if (Status === 3) return "nxdomain";
			// Status 0 = NOERROR — check for actual A/CNAME records
			if (Status === 0 && Answer?.length) return "found";
			// Status 0 but no Answer = domain exists, no A records
			if (Status === 0) return "found";
		} catch {
			continue; // try next provider
		}
	}
	return "error";
}

// ── HTTP HEAD ─────────────────────────────────────────────────────────────────

// Returns: { status: number, location?: string } | { status: 0, error: string }
async function headCheck(hostname) {
	try {
		const res = await fetch(`https://${hostname}`, {
			method: "HEAD",
			signal: AbortSignal.timeout(7000),
			redirect: "manual", // don't auto-follow — we want to see redirects
		});
		return {
			status: res.status,
			location: res.headers.get("location") ?? undefined,
		};
	} catch (err) {
		// Try http:// fallback
		try {
			const res = await fetch(`http://${hostname}`, {
				method: "HEAD",
				signal: AbortSignal.timeout(7000),
				redirect: "manual",
			});
			return { status: res.status, location: res.headers.get("location") ?? undefined };
		} catch {
			return { status: 0, error: err.message.slice(0, 60) };
		}
	}
}

// ── Classification ────────────────────────────────────────────────────────────

function classify(doh, head) {
	if (doh === "error")    return "dns-error";
	if (doh === "nxdomain") return "gone";
	// DNS resolves — look at HTTP response
	if (!head || head.status === 0) return "dead-server";
	if (head.status >= 200 && head.status < 400) return "alive";
	return "broken";
}

const LABEL = {
	gone:        "GONE       ",
	alive:       "ALIVE      ",
	broken:      "BROKEN     ",
	"dead-server": "DEAD SERVER",
	"dns-error": "DNS ERROR  ",
};

const ICON = {
	gone:        "✗",
	alive:       "✓",
	broken:      "!",
	"dead-server": "~",
	"dns-error": "?",
};

// ── Main ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

// Same query logic as db-report --errors
const rows = db.prepare(`
  WITH recent AS (SELECT id FROM scans ORDER BY id DESC LIMIT ?),
  counts AS (
    SELECT
      s.id        AS site_id,
      s.hostname,
      s.url,
      COUNT(*)    AS error_count,
      MAX(sr.error_message) AS last_error
    FROM scan_results sr
    JOIN sites  s  ON s.id  = sr.site_id
    JOIN scans  sc ON sc.id = sr.scan_id
    JOIN recent r  ON r.id  = sr.scan_id
    WHERE sr.cms = 'Error'
    GROUP BY s.id
  )
  SELECT hostname, url, error_count, last_error
  FROM counts
  WHERE error_count >= ?
  ORDER BY error_count DESC, hostname
`).all(SCANS, MIN_ERRORS);

const sites = LIMIT ? rows.slice(0, LIMIT) : rows;

console.log(`\n${hr()}`);
console.log(`  DNS CHECK — sites erroring in ${MIN_ERRORS}+ of last ${SCANS} scans`);
console.log(`  ${sites.length} sites to check${DRY_RUN ? " (dry run — skipping network)" : ""}`);
console.log(hr());

if (sites.length === 0) {
	console.log(`  ✓ No sites match the error threshold.\n`);
	process.exit(0);
}

if (DRY_RUN) {
	for (const s of sites) {
		console.log(`  ${pad(s.error_count + "/" + SCANS, 6)}  ${s.hostname}`);
	}
	console.log();
	process.exit(0);
}

// Run checks with concurrency pool
const tasks = sites.map(site => async () => {
	const doh  = await dohLookup(site.hostname);
	const head = doh !== "nxdomain" && doh !== "error"
		? await headCheck(site.hostname)
		: null;
	return { ...site, doh, head, result: classify(doh, head) };
});

process.stdout.write(`  Checking ${sites.length} sites (concurrency: ${CONCURRENCY})...\n\n`);

const checked = await pool(tasks, CONCURRENCY);

// ── Print results grouped by classification ───────────────────────────────────

const groups = { gone: [], alive: [], broken: [], "dead-server": [], "dns-error": [] };
for (const r of checked) groups[r.result].push(r);

const order = ["gone", "dead-server", "broken", "alive", "dns-error"];

for (const key of order) {
	const g = groups[key];
	if (!g.length) continue;
	console.log(`\n  ${ICON[key]}  ${LABEL[key]}  (${g.length})`);
	console.log(`  ${hr("·", 68)}`);
	for (const r of g) {
		const errs = lpad(`${r.error_count}/${SCANS}`, 4);
		const http = r.head?.status ? `  HTTP ${r.head.status}` : "";
		const loc  = r.head?.location ? `  → ${r.head.location.slice(0, 50)}` : "";
		console.log(`  ${errs}  ${r.hostname}${http}${loc}`);
	}
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${hr()}`);
console.log("  SUMMARY");
console.log(hr("·", 72));
for (const key of order) {
	const n = groups[key].length;
	if (n) console.log(`  ${pad(ICON[key] + "  " + LABEL[key], 18)}  ${n}`);
}
const goneCount = groups.gone.length;
if (goneCount) {
	console.log(`\n  ${goneCount} domain${goneCount > 1 ? "s" : ""} appear gone — candidates for removal from the showcase.`);
}
console.log();
