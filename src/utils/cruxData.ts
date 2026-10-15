// src/utils/cruxData.ts
// 2026-10-15T00:00:00Z
//
// Latest CrUX field data per Astro-detected site, plus headline counts. Shared
// by the /crux/ page (first page of rows) and /crux-rows/ (the rest).
import Database from "better-sqlite3";

export function loadCrux() {
	// biome-ignore lint/suspicious/noExplicitAny: raw better-sqlite3 rows, shape defined by the SELECT below
	let sites: any[] = [];
	let generatedAt = "";
	let totalWithData = 0;
	let desktopCount = 0;
	let phoneCount = 0;
	let tabletCount = 0;
	let desktopCwvPass = 0;
	let phoneCwvPass = 0;

	try {
		const db = new Database(".scan-history.db", { readonly: true });
		const run = db
			.prepare("SELECT id, started_at FROM crux_runs ORDER BY id DESC LIMIT 1")
			.get() as { id: number; started_at: string };
		const latestScan = db
			.prepare("SELECT id FROM scans ORDER BY id DESC LIMIT 1")
			.get() as { id: number };

		generatedAt = run.started_at;

		sites = db
			.prepare(
				`WITH latest_ff AS (
	        SELECT site_id, form_factor, MAX(run_id) AS run_id
	        FROM crux_results WHERE status = 'success'
	        GROUP BY site_id, form_factor
	      )
	      SELECT
	        s.hostname, s.url,
	        sr.title, sr.astro_version,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.lcp_p75 END)    as d_lcp,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.inp_p75 END)    as d_inp,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.cls_p75 END)    as d_cls,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.lcp_rating END) as d_lcp_r,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.inp_rating END) as d_inp_r,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.cls_rating END) as d_cls_r,
	        MAX(CASE WHEN cr.form_factor='DESKTOP' THEN cr.cwv_pass END)   as d_cwv,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.lcp_p75 END)      as p_lcp,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.inp_p75 END)      as p_inp,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.cls_p75 END)      as p_cls,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.lcp_rating END)   as p_lcp_r,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.inp_rating END)   as p_inp_r,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.cls_rating END)   as p_cls_r,
	        MAX(CASE WHEN cr.form_factor='PHONE' THEN cr.cwv_pass END)     as p_cwv,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.lcp_p75 END)     as t_lcp,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.inp_p75 END)     as t_inp,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.cls_p75 END)     as t_cls,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.lcp_rating END)  as t_lcp_r,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.inp_rating END)  as t_inp_r,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.cls_rating END)  as t_cls_r,
	        MAX(CASE WHEN cr.form_factor='TABLET' THEN cr.cwv_pass END)    as t_cwv
	      FROM latest_ff lf
	      JOIN crux_results cr ON cr.site_id = lf.site_id
	        AND cr.form_factor = lf.form_factor AND cr.run_id = lf.run_id
	      JOIN sites s ON s.id = cr.site_id
	      JOIN scan_results sr ON sr.site_id = s.id AND sr.scan_id = ?
	        AND sr.astro_detected = 1
	      GROUP BY s.id
	      HAVING d_lcp IS NOT NULL OR p_lcp IS NOT NULL OR t_lcp IS NOT NULL
	      ORDER BY s.hostname`,
			)
			// biome-ignore lint/suspicious/noExplicitAny: raw better-sqlite3 rows, shape defined by the SELECT above
			.all(latestScan.id) as any[];

		totalWithData = sites.length;
		desktopCount = sites.filter((s) => s.d_lcp !== null).length;
		phoneCount = sites.filter((s) => s.p_lcp !== null).length;
		tabletCount = sites.filter((s) => s.t_lcp !== null).length;
		desktopCwvPass = sites.filter((s) => s.d_cwv === 1).length;
		phoneCwvPass = sites.filter((s) => s.p_cwv === 1).length;

		db.close();
	} catch (e) {
		console.warn("CrUX DB not available:", e);
	}

	return {
		sites,
		generatedAt,
		totalWithData,
		desktopCount,
		phoneCount,
		tabletCount,
		desktopCwvPass,
		phoneCwvPass,
	};
}
