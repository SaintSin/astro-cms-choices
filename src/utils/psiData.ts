// src/utils/psiData.ts
// 2026-10-15T00:00:00Z
//
// Latest PSI results per Astro-detected site, plus the headline counts. Shared
// by the /psi/ page (first page of rows) and /psi-rows/ (the rest).
import Database from "better-sqlite3";

export function loadPsi() {
	// biome-ignore lint/suspicious/noExplicitAny: raw better-sqlite3 rows, shape defined by the SELECT below
	let sites: any[] = [];
	let generatedAt = "";
	let mobileCount = 0;
	let desktopCount = 0;
	let mobilePerfHigh = 0;
	let desktopPerfHigh = 0;
	let perfect800 = 0;
	let high800 = 0;

	try {
		const db = new Database(".scan-history.db", { readonly: true });

		const latestScan = db
			.prepare("SELECT id FROM scans ORDER BY id DESC LIMIT 1")
			.get() as { id: number };

		const latestRun = db
			.prepare("SELECT id, started_at FROM psi_runs ORDER BY id DESC LIMIT 1")
			.get() as { id: number; started_at: string };

		generatedAt = latestRun.started_at;

		// Latest successful result per site × strategy across all runs
		sites = db
			.prepare(
				`WITH latest_mobile AS (
	        SELECT site_id, MAX(run_id) AS run_id
	        FROM psi_results WHERE status = 'success' AND strategy = 'mobile'
	        GROUP BY site_id
	      ),
	      latest_desktop AS (
	        SELECT site_id, MAX(run_id) AS run_id
	        FROM psi_results WHERE status = 'success' AND strategy = 'desktop'
	        GROUP BY site_id
	      )
	      SELECT
	        s.hostname, s.url,
	        sr.title, sr.astro_version,
	        m.performance   AS m_perf,
	        m.accessibility AS m_a11y,
	        m.best_practices AS m_bp,
	        m.seo           AS m_seo,
	        m.agentic_passed     AS m_agentic_passed,
	        m.agentic_applicable AS m_agentic_applicable,
	        d.performance   AS d_perf,
	        d.accessibility AS d_a11y,
	        d.best_practices AS d_bp,
	        d.seo           AS d_seo,
	        d.agentic_passed     AS d_agentic_passed,
	        d.agentic_applicable AS d_agentic_applicable
	      FROM sites s
	      JOIN scan_results sr ON sr.site_id = s.id
	        AND sr.scan_id = ?
	        AND sr.astro_detected = 1
	      LEFT JOIN latest_mobile lm ON lm.site_id = s.id
	      LEFT JOIN psi_results m ON m.site_id = lm.site_id
	        AND m.run_id = lm.run_id AND m.strategy = 'mobile'
	      LEFT JOIN latest_desktop ld ON ld.site_id = s.id
	      LEFT JOIN psi_results d ON d.site_id = ld.site_id
	        AND d.run_id = ld.run_id AND d.strategy = 'desktop'
	      WHERE m.performance IS NOT NULL OR d.performance IS NOT NULL
	      ORDER BY s.hostname`,
			)
			// biome-ignore lint/suspicious/noExplicitAny: raw better-sqlite3 rows, shape defined by the SELECT above
			.all(latestScan.id) as any[];

		mobileCount = sites.filter((s) => s.m_perf !== null).length;
		desktopCount = sites.filter((s) => s.d_perf !== null).length;
		mobilePerfHigh = sites.filter(
			(s) => s.m_perf !== null && s.m_perf >= 90,
		).length;
		desktopPerfHigh = sites.filter(
			(s) => s.d_perf !== null && s.d_perf >= 90,
		).length;

		// biome-ignore lint/suspicious/noExplicitAny: raw better-sqlite3 row, shape defined by the SELECT above
		const t800 = (s: any) => {
			const m =
				s.m_perf !== null &&
				s.m_a11y !== null &&
				s.m_bp !== null &&
				s.m_seo !== null
					? s.m_perf + s.m_a11y + s.m_bp + s.m_seo
					: null;
			const d =
				s.d_perf !== null &&
				s.d_a11y !== null &&
				s.d_bp !== null &&
				s.d_seo !== null
					? s.d_perf + s.d_a11y + s.d_bp + s.d_seo
					: null;
			return m !== null && d !== null ? m + d : null;
		};
		perfect800 = sites.filter((s) => t800(s) === 800).length;
		high800 = sites.filter((s) => {
			const v = t800(s);
			return v !== null && v >= 720;
		}).length;

		db.close();
	} catch (e) {
		console.warn("PSI DB not available:", e);
	}

	return {
		sites,
		generatedAt,
		mobileCount,
		desktopCount,
		mobilePerfHigh,
		desktopPerfHigh,
		perfect800,
		high800,
	};
}
