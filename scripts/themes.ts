// scripts/themes.ts
// 2026-10-28T00:00:00Z
//
// Astro themes catalogue: free/paid, demo Astro version, web host, PSI scores.
//
// Source: portal.astro.build (the API behind astro.build/themes). The list
// endpoint has no demo URLs, so the catalogue is built from the per-month
// endpoint, which does. Writes `themes` and `theme_psi` in .scan-history.db —
// separate from the showcase tables (sites / psi_results).
//
// Usage:
//   pnpm themes                    # sync catalogue, then probe unprobed demos
//   pnpm themes --probe-all        # re-probe every demo (Astro version + host)
//   pnpm themes --psi              # PSI for themes with no result yet
//   pnpm themes --psi --all        # re-score every theme (adds a new row each; the page shows the latest)
//   pnpm themes --psi --errors-only
//   pnpm themes --psi --limit=20   # cap themes (testing)
//   pnpm themes --psi --concurrency=2   # workers per strategy (default 2)
//
// --psi needs PAGESPEED_API_KEY in .env.

import Database from "better-sqlite3";
import { detectAstro } from "./detect-cms.ts";
import { fetchWithRetry } from "./fetch-retry.mjs";

const args = process.argv.slice(2);
const arg = (name: string) =>
	args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const limit = Number(arg("--limit") ?? 0) || undefined;
const workersPerStrategy = Number(arg("--concurrency") ?? 2);

try {
	process.loadEnvFile(".env");
} catch {
	/* checked below when --psi needs the key */
}

const db = new Database(".scan-history.db");
db.pragma("journal_mode = WAL");
db.exec(`
	CREATE TABLE IF NOT EXISTS themes (
		slug           TEXT PRIMARY KEY,
		title          TEXT NOT NULL,
		author         TEXT,
		paid           INTEGER NOT NULL,
		demo_url       TEXT,
		repo_url       TEXT,
		publish_date   TEXT,
		synced_at      TEXT NOT NULL,
		probed_at      TEXT,
		probe_status   TEXT,
		astro_detected INTEGER,
		astro_version  TEXT,
		host           TEXT
	);
	CREATE TABLE IF NOT EXISTS theme_psi (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		slug           TEXT NOT NULL REFERENCES themes(slug),
		fetched_at     TEXT NOT NULL,
		strategy       TEXT NOT NULL,
		status         TEXT NOT NULL,
		performance    INTEGER,
		accessibility  INTEGER,
		best_practices INTEGER,
		seo            INTEGER,
		lab_lcp        TEXT,
		lab_cls        TEXT,
		lab_tbt        TEXT,
		error          TEXT,
		agentic_passed     INTEGER,
		agentic_applicable INTEGER
	);
	CREATE INDEX IF NOT EXISTS idx_theme_psi_slug ON theme_psi(slug);
`);
// Agentic columns were added after the first PSI run
for (const col of ["agentic_passed INTEGER", "agentic_applicable INTEGER"]) {
	try {
		db.exec(`ALTER TABLE theme_psi ADD COLUMN ${col}`);
	} catch {
		/* already exists */
	}
}

// ── Catalogue ────────────────────────────────────────────────────────────────

interface PortalTheme {
	Theme: {
		slug: string;
		title: string;
		paid: boolean;
		demoUrl: string | null;
		repoUrl: string | null;
		publishDate: string;
	};
	Author: { name: string } | null;
}

async function syncCatalogue() {
	const upsert = db.prepare(`
		INSERT INTO themes (slug, title, author, paid, demo_url, repo_url, publish_date, synced_at)
		VALUES (@slug, @title, @author, @paid, @demo, @repo, @date, @now)
		ON CONFLICT(slug) DO UPDATE SET
			title = @title, author = @author, paid = @paid, repo_url = @repo,
			publish_date = @date, synced_at = @now,
			-- a changed demo URL invalidates the old probe
			probed_at = CASE WHEN demo_url IS @demo THEN probed_at ELSE NULL END,
			demo_url = @demo
	`);
	const now = new Date();
	const stamp = now.toISOString();
	let total = 0;
	for (let y = 2021, m = 0; y < now.getFullYear() || m <= now.getMonth();) {
		const month = new Date(Date.UTC(y, m, 1)).toISOString();
		const res = await fetchWithRetry(
			`https://portal.astro.build/api/themes/monthly?month=${month}`,
		);
		const rows = (await res.json()) as PortalTheme[];
		db.transaction(() => {
			for (const { Theme: t, Author: a } of rows) {
				upsert.run({
					slug: t.slug,
					title: t.title,
					author: a?.name ?? null,
					paid: t.paid ? 1 : 0,
					demo: t.demoUrl || null,
					repo: t.repoUrl || null,
					date: t.publishDate,
					now: stamp,
				});
			}
		})();
		total += rows.length;
		if (++m === 12) [y, m] = [y + 1, 0];
	}
	const n = db.prepare("SELECT COUNT(*) n FROM themes").get() as { n: number };
	console.log(`Catalogue: ${total} fetched, ${n.n} themes in DB`);
}

// ── Probe: Astro version + web host ──────────────────────────────────────────

// First match wins, so edge-network markers (Cloudflare, CloudFront) come
// after the platforms that sit behind them.
const HOSTS: [string, (h: Headers) => boolean][] = [
	[
		"Netlify",
		(h) => h.has("x-nf-request-id") || /netlify/i.test(h.get("server") ?? ""),
	],
	[
		"Vercel",
		(h) => h.has("x-vercel-id") || /vercel/i.test(h.get("server") ?? ""),
	],
	[
		"GitHub Pages",
		(h) =>
			h.has("x-github-request-id") ||
			/github\.com/i.test(h.get("server") ?? ""),
	],
	["Render", (h) => h.has("x-render-origin-server")],
	["Fly.io", (h) => h.has("fly-request-id")],
	["Azure", (h) => h.has("x-azure-ref")],
	[
		"Cloudflare",
		(h) => h.has("cf-ray") || /cloudflare/i.test(h.get("server") ?? ""),
	],
	[
		"AWS",
		(h) =>
			h.has("x-amz-cf-id") ||
			h.has("x-amz-request-id") ||
			/amazons3|cloudfront/i.test(`${h.get("server")} ${h.get("via")}`),
	],
	[
		"Google Cloud",
		(h) =>
			/google/i.test(`${h.get("server")} ${h.get("via")}`) ||
			h.has("x-goog-generation"),
	],
	[
		"Hostinger",
		(h) => /hcdn|hostinger/i.test(`${h.get("server")} ${h.get("platform")}`),
	],
];

function hostOf(h: Headers): string {
	for (const [name, test] of HOSTS) if (test(h)) return name;
	return h.get("server")?.split("/")[0] || "Unknown";
}

async function probe(slug: string, url: string) {
	const set = db.prepare(`
		UPDATE themes SET probed_at = ?, probe_status = ?, astro_detected = ?,
			astro_version = ?, host = ? WHERE slug = ?
	`);
	const now = new Date().toISOString();
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(15000),
			headers: { "user-agent": "Mozilla/5.0 (compatible; astro-what-cms)" },
			redirect: "follow",
		});
		const html = await res.text();
		const astro = detectAstro(html);
		set.run(
			now,
			`http-${res.status}`,
			astro.detected ? 1 : 0,
			astro.version,
			hostOf(res.headers),
			slug,
		);
	} catch (e) {
		set.run(
			now,
			`error: ${(e as Error).message.slice(0, 80)}`,
			null,
			null,
			null,
			slug,
		);
	}
}

async function runPool<T>(
	items: T[],
	workers: number,
	fn: (x: T) => Promise<void>,
) {
	const queue = [...items];
	await Promise.all(
		Array.from({ length: workers }, async () => {
			for (let x = queue.shift(); x !== undefined; x = queue.shift())
				await fn(x);
		}),
	);
}

async function probeDemos() {
	const where = args.includes("--probe-all") ? "" : "AND probed_at IS NULL";
	const todo = db
		.prepare(
			`SELECT slug, demo_url FROM themes WHERE demo_url IS NOT NULL ${where}`,
		)
		.all() as { slug: string; demo_url: string }[];
	const batch = limit ? todo.slice(0, limit) : todo;
	let done = 0;
	await runPool(batch, 20, async (t) => {
		await probe(t.slug, t.demo_url);
		if (++done % 100 === 0) console.log(`  probed ${done}/${batch.length}`);
	});
	console.log(`Probed ${batch.length} demo(s)`);
}

// ── PSI ──────────────────────────────────────────────────────────────────────

const pct = (
	cats: Record<string, { score?: number }> | undefined,
	id: string,
) => (cats?.[id]?.score != null ? Math.round(cats[id].score * 100) : null);

// Agentic Browsing is shown as audits passed / applicable, as on /psi/: a
// percentage would mislead since most audits are notApplicable unless the page
// implements the feature. "Passed" follows Lighthouse's green threshold (>= 0.9).
function agenticBrowsing(cats: any, audits: any) {
	const cat = cats?.["agentic-browsing"];
	if (!cat) return { agentic_passed: null, agentic_applicable: null };
	let passed = 0;
	let applicable = 0;
	for (const ref of cat.auditRefs) {
		const a = audits?.[ref.id];
		if (!a || a.scoreDisplayMode === "notApplicable") continue;
		applicable++;
		if (a.score != null && a.score >= 0.9) passed++;
	}
	return { agentic_passed: passed, agentic_applicable: applicable };
}

async function runPsi() {
	const key = process.env.PAGESPEED_API_KEY;
	if (!key) throw new Error("PAGESPEED_API_KEY not set in .env");
	const strategies = ["mobile", "desktop"];
	const errorsOnly = args.includes("--errors-only");
	// Only demos that loaded. Skip combos with a success; retry errors only on request.
	const themes = db
		.prepare(
			`SELECT slug, demo_url FROM themes
			 WHERE demo_url IS NOT NULL AND probe_status = 'http-200'
			 ORDER BY slug`,
		)
		.all() as { slug: string; demo_url: string }[];
	// A slug:strategy combo is done once it has a success; with --errors-only
	// that is the only thing that counts, otherwise any row (even an error) does.
	const done = new Set(
		args.includes("--all")
			? []
			: (
					db
						.prepare(
							`SELECT slug, strategy FROM theme_psi ${errorsOnly ? "WHERE status = 'success'" : ""}`,
						)
						.all() as { slug: string; strategy: string }[]
				).map((r) => `${r.slug}:${r.strategy}`),
	);
	let pending = themes.filter((t) =>
		strategies.some((s) => !done.has(`${t.slug}:${s}`)),
	);
	if (limit) pending = pending.slice(0, limit);

	const insert = db.prepare(`
		INSERT INTO theme_psi (slug, fetched_at, strategy, status, performance, accessibility,
			best_practices, seo, lab_lcp, lab_cls, lab_tbt, error, agentic_passed, agentic_applicable)
		VALUES (@slug, @at, @strategy, @status, @performance, @accessibility,
			@best_practices, @seo, @lab_lcp, @lab_cls, @lab_tbt, @error, @agentic_passed, @agentic_applicable)
	`);
	const blank = {
		performance: null,
		accessibility: null,
		best_practices: null,
		seo: null,
		lab_lcp: null,
		lab_cls: null,
		lab_tbt: null,
		error: null,
		agentic_passed: null,
		agentic_applicable: null,
	};
	let n = 0;
	const total = pending.length * strategies.length;
	console.log(
		`PSI: ${pending.length} themes × ${strategies.length} strategies`,
	);
	await Promise.all(
		strategies.map((strategy) => {
			const jobs = pending.filter((t) => !done.has(`${t.slug}:${strategy}`));
			return runPool(jobs, workersPerStrategy, async (t) => {
				const at = new Date().toISOString();
				try {
					const qs =
						`url=${encodeURIComponent(t.demo_url)}&strategy=${strategy}&key=${key}` +
						"&category=performance&category=accessibility&category=best-practices&category=seo&category=agentic-browsing";
					const res = await fetchWithRetry(
						`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`,
					);
					if (!res.ok) {
						const body = (await res.json().catch(() => null)) as {
							error?: { message?: string };
						} | null;
						throw new Error(`HTTP ${res.status} ${body?.error?.message ?? ""}`);
					}
					const lh = ((await res.json()) as { lighthouseResult?: any })
						.lighthouseResult;
					const perf = pct(lh?.categories, "performance");
					if (perf == null)
						throw new Error(
							lh?.runtimeError?.message ?? "No performance score returned",
						);
					const a = lh.audits;
					const agentic = agenticBrowsing(lh.categories, a);
					insert.run({
						...blank,
						slug: t.slug,
						at,
						strategy,
						status: "success",
						performance: perf,
						accessibility: pct(lh.categories, "accessibility"),
						best_practices: pct(lh.categories, "best-practices"),
						seo: pct(lh.categories, "seo"),
						lab_lcp: a["largest-contentful-paint"]?.displayValue ?? null,
						lab_cls: a["cumulative-layout-shift"]?.displayValue ?? null,
						lab_tbt: a["total-blocking-time"]?.displayValue ?? null,
						...agentic,
					});
					console.log(
						`  [${++n}/${total}] ${t.slug.slice(0, 40).padEnd(40)} ${strategy.padEnd(7)} ${perf}`,
					);
				} catch (e) {
					const msg = (e as Error).message.slice(0, 200);
					insert.run({
						...blank,
						slug: t.slug,
						at,
						strategy,
						status: "error",
						error: msg,
					});
					console.log(
						`  [${++n}/${total}] ${t.slug.slice(0, 40).padEnd(40)} ${strategy.padEnd(7)} ERROR ${msg.slice(0, 60)}`,
					);
				}
				await new Promise((r) => setTimeout(r, 700));
			});
		}),
	);
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (args.includes("--psi")) {
	await runPsi();
} else {
	await syncCatalogue();
	await probeDemos();
}
db.close();
