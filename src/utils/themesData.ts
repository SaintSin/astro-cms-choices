// src/utils/themesData.ts
// 2026-10-28T00:00:00Z
//
// Astro themes with demo Astro version, web host and latest PSI scores.
// Written by scripts/themes.ts into .scan-history.db (themes, theme_psi).
import Database from "better-sqlite3";

export interface ThemeRow {
	slug: string;
	title: string;
	author: string | null;
	paid: number;
	demo_url: string | null;
	publish_date: string | null;
	probe_status: string | null;
	astro_detected: number | null;
	astro_version: string | null;
	host: string | null;
	m_perf: number | null;
	m_a11y: number | null;
	m_bp: number | null;
	m_seo: number | null;
	m_agentic_passed: number | null;
	m_agentic_applicable: number | null;
	d_perf: number | null;
	d_a11y: number | null;
	d_bp: number | null;
	d_seo: number | null;
	d_agentic_passed: number | null;
	d_agentic_applicable: number | null;
	psi_blocked: number;
	cms: string | null;
}

// A run whose page returned an error status (dead demo) scores like a blank
// page, so it must not feed the best-of-runs scores.
const VALID_RUN =
	"COALESCE(p.failed_audits, '') NOT LIKE '%seo:http-status-code%'";

export function loadThemes() {
	let themes: ThemeRow[] = [];
	let generatedAt = "";
	try {
		const db = new Database(".scan-history.db", { readonly: true });
		generatedAt =
			(
				db.prepare("SELECT MAX(fetched_at) AS t FROM theme_psi").get() as {
					t: string | null;
				}
			).t ?? "";
		// Best successful score per theme × strategy across all runs: PSI varies
		// run to run, so a single bad run shouldn't mark a theme down.
		const latest = (strategy: string, col: string) =>
			col.startsWith("agentic")
				? // keep passed/applicable from the same run: the one that passed most
					`(SELECT ${col} FROM theme_psi p WHERE p.slug = t.slug AND p.strategy = '${strategy}'
					   AND p.status = 'success' AND ${VALID_RUN} ORDER BY p.agentic_passed DESC, p.id DESC LIMIT 1)`
				: `(SELECT MAX(${col}) FROM theme_psi p WHERE p.slug = t.slug AND p.strategy = '${strategy}'
					   AND p.status = 'success' AND ${VALID_RUN})`;
		themes = db
			.prepare(
				`SELECT t.slug, t.title, t.author, t.paid, t.demo_url, t.publish_date,
				        t.probe_status, t.astro_detected, t.astro_version, t.host, t.cms,
				        ${latest("mobile", "performance")} AS m_perf,
				        ${latest("mobile", "accessibility")} AS m_a11y,
				        ${latest("mobile", "best_practices")} AS m_bp,
				        ${latest("mobile", "seo")} AS m_seo,
				        ${latest("mobile", "agentic_passed")} AS m_agentic_passed,
				        ${latest("mobile", "agentic_applicable")} AS m_agentic_applicable,
				        ${latest("desktop", "performance")} AS d_perf,
				        ${latest("desktop", "accessibility")} AS d_a11y,
				        ${latest("desktop", "best_practices")} AS d_bp,
				        ${latest("desktop", "seo")} AS d_seo,
				        ${latest("desktop", "agentic_passed")} AS d_agentic_passed,
				        ${latest("desktop", "agentic_applicable")} AS d_agentic_applicable,
				        EXISTS (SELECT 1 FROM theme_psi p WHERE p.slug = t.slug AND NOT ${VALID_RUN}) AS psi_blocked
				 FROM themes t ORDER BY t.title COLLATE NOCASE`,
			)
			.all() as ThemeRow[];
		db.close();
	} catch {
		// No DB or no themes tables yet — render an empty page
	}
	const tested = themes.filter((t) => t.m_perf !== null);
	const avg = (rows: ThemeRow[], k: "m_perf" | "d_perf") => {
		const v = rows.map((r) => r[k]).filter((n): n is number => n !== null);
		return v.length
			? Math.round(v.reduce((a, b) => a + b, 0) / v.length)
			: null;
	};
	const free = themes.filter((t) => !t.paid);
	const paid = themes.filter((t) => t.paid);
	return {
		themes,
		generatedAt,
		freeCount: free.length,
		paidCount: paid.length,
		testedCount: tested.length,
		astroCount: themes.filter((t) => t.astro_detected === 1).length,
		freeMobileAvg: avg(free, "m_perf"),
		paidMobileAvg: avg(paid, "m_perf"),
		freeDesktopAvg: avg(free, "d_perf"),
		paidDesktopAvg: avg(paid, "d_perf"),
		hosts: [
			...new Set(themes.map((t) => t.host).filter(Boolean)),
		].sort() as string[],
	};
}
