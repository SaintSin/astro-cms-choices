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
	d_perf: number | null;
	d_a11y: number | null;
	d_bp: number | null;
	d_seo: number | null;
}

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
		// Latest successful result per theme × strategy
		const latest = (strategy: string, col: string) =>
			`(SELECT ${col} FROM theme_psi p WHERE p.slug = t.slug AND p.strategy = '${strategy}'
			   AND p.status = 'success' ORDER BY p.id DESC LIMIT 1)`;
		themes = db
			.prepare(
				`SELECT t.slug, t.title, t.author, t.paid, t.demo_url, t.publish_date,
				        t.probe_status, t.astro_detected, t.astro_version, t.host,
				        ${latest("mobile", "performance")} AS m_perf,
				        ${latest("mobile", "accessibility")} AS m_a11y,
				        ${latest("mobile", "best_practices")} AS m_bp,
				        ${latest("mobile", "seo")} AS m_seo,
				        ${latest("desktop", "performance")} AS d_perf,
				        ${latest("desktop", "accessibility")} AS d_a11y,
				        ${latest("desktop", "best_practices")} AS d_bp,
				        ${latest("desktop", "seo")} AS d_seo
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
		hosts: [
			...new Set(themes.map((t) => t.host).filter(Boolean)),
		].sort() as string[],
	};
}
