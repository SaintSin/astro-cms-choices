// scripts/admin-handler.mjs
// 2026-05-27T00:00:00Z
//
// Vite dev-server middleware for the local admin review UI.
// Mounted at /admin by the plugin in astro.config.mjs — dev-only, never shipped.
//
// Routes:
//   GET  /admin              → serve the review UI page
//   GET  /admin/api/queue    → JSON list of sites pending manual review
//   POST /admin/api/review   → save a review decision
//   GET  /admin/api/export   → PR-ready export for sites marked "remove"

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(".scan-history.db");
const UI_PATH = resolve(__dirname, "admin-ui.html");

// ── DB connection (lazily opened, cached for the process lifetime) ─────────────

let _db = null;

function getDb() {
	if (_db) return _db;
	_db = new Database(DB_PATH);
	_db.pragma("journal_mode = WAL");
	_db.pragma("foreign_keys = ON");
	// Ensure reviews table exists (other tables created by db-utils / pnpm detect)
	_db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id       INTEGER NOT NULL REFERENCES sites(id),
      reviewed_at   TEXT    NOT NULL,
      decision      TEXT    NOT NULL,
      cms_confirmed TEXT,
      notes         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_site ON reviews(site_id, reviewed_at DESC);
  `);
	return _db;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonResp(res, data, status = 200) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}

function readBody(req) {
	return new Promise((resolve) => {
		let raw = "";
		req.on("data", (c) => (raw += c));
		req.on("end", () => {
			try {
				resolve(JSON.parse(raw));
			} catch {
				resolve({});
			}
		});
	});
}

// ── Route: GET /admin/api/queue ────────────────────────────────────────────────
//
// Returns all sites where the latest scan detected no Astro, with any known CMS.
// Includes the latest manual review decision (if any).

function handleQueue(res) {
	const db = getDb();

	const rows = db
		.prepare(
			`WITH latest_scan AS (
        SELECT id FROM scans ORDER BY id DESC LIMIT 1
      ),
      latest_review AS (
        SELECT r.*,
               ROW_NUMBER() OVER (PARTITION BY r.site_id ORDER BY r.reviewed_at DESC) AS rn
        FROM reviews r
      )
      SELECT
        s.id           AS site_id,
        s.url,
        s.hostname,
        sr.title,
        sr.cms,
        sr.cms_type,
        sr.confidence,
        sr.astro_detected,
        sr.final_url,
        sr.error_message,
        COALESCE(lr.decision, 'pending') AS decision,
        lr.notes,
        lr.cms_confirmed,
        lr.reviewed_at  AS review_date
      FROM scan_results sr
      JOIN sites      s  ON s.id  = sr.site_id
      JOIN latest_scan ls ON sr.scan_id = ls.id
      LEFT JOIN latest_review lr ON lr.site_id = s.id AND lr.rn = 1
      WHERE sr.astro_detected = 0
        AND sr.cms NOT IN ('Unknown', 'Error', 'Blocked')
      ORDER BY
        CASE sr.cms_type
          WHEN 'full-site'    THEN 1
          WHEN 'page-builder' THEN 2
          WHEN 'framework'    THEN 3
          WHEN 'static-gen'   THEN 4
          WHEN 'headless-cms' THEN 5
          WHEN 'parked'       THEN 6
          ELSE 7
        END,
        sr.cms,
        s.hostname`,
		)
		.all();

	jsonResp(res, { sites: rows });
}

// ── Route: POST /admin/api/review ──────────────────────────────────────────────
//
// Body: { siteId, decision, notes?, cmsConfirmed? }
// decision: 'remove' | 'keep' | 'rescan' | 'skip' | 'pending'
// 'pending' is stored to explicitly clear a previous decision (toggle-off).

async function handleReview(req, res) {
	const body = await readBody(req);
	const { siteId, decision, notes, cmsConfirmed } = body;

	if (!siteId || !decision) {
		return jsonResp(res, { error: "siteId and decision are required" }, 400);
	}

	const db = getDb();
	db.prepare(
		`INSERT INTO reviews (site_id, reviewed_at, decision, cms_confirmed, notes)
     VALUES (?, ?, ?, ?, ?)`,
	).run(
		Number(siteId),
		new Date().toISOString(),
		decision,
		cmsConfirmed ?? null,
		notes ?? null,
	);

	jsonResp(res, { ok: true });
}

// ── Route: GET /admin/api/export ───────────────────────────────────────────────
//
// Returns PR-ready content for all sites currently marked decision = 'remove'.

function handleExport(res) {
	const db = getDb();

	const sites = db
		.prepare(
			`WITH latest_scan AS (
        SELECT id FROM scans ORDER BY id DESC LIMIT 1
      ),
      latest_review AS (
        SELECT r.*,
               ROW_NUMBER() OVER (PARTITION BY r.site_id ORDER BY r.reviewed_at DESC) AS rn
        FROM reviews r
      )
      SELECT
        s.hostname,
        s.url,
        sr.title,
        sr.cms,
        lr.notes,
        lr.reviewed_at
      FROM scan_results sr
      JOIN sites       s  ON s.id  = sr.site_id
      JOIN latest_scan ls ON sr.scan_id = ls.id
      JOIN latest_review lr ON lr.site_id = s.id AND lr.rn = 1
      WHERE sr.scan_id = ls.id
        AND lr.decision = 'remove'
      ORDER BY sr.cms, s.hostname`,
		)
		.all();

	const count = sites.length;
	if (count === 0) {
		return jsonResp(res, { count: 0, sites: [] });
	}

	const prTitle = `Remove ${count} site${count !== 1 ? "s" : ""} no longer running Astro`;

	const tableRows = sites
		.map((s) => `| [${s.hostname}](${s.url}) | ${s.cms} | ${s.notes ?? "—"} |`)
		.join("\n");

	const prBody = `## Summary

These ${count} sites in the Astro Showcase are no longer running Astro, confirmed by automated detection ([astro-what-cms](https://astro-what-cms.netlify.app)) and manual review.

| Site | Now running | Notes |
|------|-------------|-------|
${tableRows}

All removed domains have been added to \`blockedOrigins\` in \`scripts/update-showcase.mjs\` to prevent them being re-added by the weekly CI check.`;

	const blockedOriginsBlock = sites.map((s) => `  "${s.hostname}",`).join("\n");

	const yamlFiles = sites.map((s) => `${s.hostname}.yml`);

	jsonResp(res, {
		count,
		sites,
		prTitle,
		prBody,
		blockedOriginsBlock,
		yamlFiles,
	});
}

// ── Main request handler (exported, mounted by astro.config.mjs) ──────────────

export function handleRequest(req, res, next) {
	const url = new URL(req.url, "http://localhost");
	const path = url.pathname.replace(/\/$/, "") || "/admin";

	// Serve the UI
	if (path === "/admin") {
		let html;
		try {
			html = readFileSync(UI_PATH, "utf8");
		} catch {
			res.writeHead(500);
			res.end("Admin UI not found. Check scripts/admin-ui.html");
			return;
		}
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(html);
		return;
	}

	// API routes
	if (path === "/admin/api/queue" && req.method === "GET") {
		try {
			handleQueue(res);
		} catch (err) {
			console.error("[admin] queue error:", err);
			jsonResp(res, { error: String(err) }, 500);
		}
		return;
	}

	if (path === "/admin/api/review" && req.method === "POST") {
		handleReview(req, res).catch((err) => {
			console.error("[admin] review error:", err);
			jsonResp(res, { error: String(err) }, 500);
		});
		return;
	}

	if (path === "/admin/api/export" && req.method === "GET") {
		try {
			handleExport(res);
		} catch (err) {
			console.error("[admin] export error:", err);
			jsonResp(res, { error: String(err) }, 500);
		}
		return;
	}

	next();
}
