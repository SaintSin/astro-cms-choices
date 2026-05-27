// scripts/db-utils.ts
// 2026-05-27T00:00:00Z
//
// Shared SQLite utilities for the scan-history database.
// Used by detect-cms.ts (writes) and db-report.ts (reads).
//
// DB file: .scan-history.db  (gitignored, local only)

import Database from "better-sqlite3";
import { resolve } from "node:path";
import type { CmsResult, ResultsFile } from "./detect-cms.ts";

export const DB_PATH = resolve(".scan-history.db");

// ---------------------------------------------------------------------------
// Open (and auto-init) the database
// ---------------------------------------------------------------------------

export function openDb(): Database.Database {
	const db = new Database(DB_PATH);
	// WAL mode: better concurrent read performance
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");
	initSchema(db);
	return db;
}

// ---------------------------------------------------------------------------
// Schema — idempotent (CREATE IF NOT EXISTS throughout)
// ---------------------------------------------------------------------------

function initSchema(db: Database.Database): void {
	db.exec(`
    -- One row per pnpm detect run
    CREATE TABLE IF NOT EXISTS scans (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      scanned_at      TEXT NOT NULL,      -- ISO-8601 datetime of the run
      source_dir      TEXT NOT NULL,      -- relative path to showcase YAMLs
      total_sites     INTEGER NOT NULL,
      astro_confirmed INTEGER NOT NULL,
      errors          INTEGER NOT NULL,
      blocked         INTEGER NOT NULL,
      forwarded       INTEGER NOT NULL,
      duration_ms     INTEGER             -- wall-clock time for the full scan
    );

    -- One row per unique showcase URL — stable across scans
    CREATE TABLE IF NOT EXISTS sites (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      url           TEXT NOT NULL UNIQUE,
      hostname      TEXT NOT NULL,
      first_scan_id INTEGER REFERENCES scans(id),
      last_scan_id  INTEGER REFERENCES scans(id),
      removed       INTEGER NOT NULL DEFAULT 0  -- 1 once dropped from showcase
    );

    -- One row per site per scan — the raw detection snapshot
    CREATE TABLE IF NOT EXISTS scan_results (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id           INTEGER NOT NULL REFERENCES scans(id),
      site_id           INTEGER NOT NULL REFERENCES sites(id),
      title             TEXT,
      cms               TEXT NOT NULL,        -- "WordPress", "Unknown", "Error", "Blocked", "Forwarded", ...
      cms_type          TEXT NOT NULL,        -- "headless-cms", "full-site", "framework", "unknown", ...
      confidence        TEXT,                 -- "high" | "medium" | "low" | NULL
      astro_detected    INTEGER NOT NULL,     -- 0 | 1
      astro_version     TEXT,                 -- "5.5.2" | NULL
      starlight_version TEXT,
      astro_signals     TEXT,                 -- JSON array, e.g. '["generator meta tag","/_astro/ asset path"]'
      final_url         TEXT,                 -- redirect destination (Forwarded sites)
      error_message     TEXT,                 -- network/timeout error string
      fetched_at        TEXT,                 -- ISO-8601 of the individual fetch
      UNIQUE(scan_id, site_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sr_site    ON scan_results(site_id);
    CREATE INDEX IF NOT EXISTS idx_sr_scan    ON scan_results(scan_id);
    CREATE INDEX IF NOT EXISTS idx_sr_cms     ON scan_results(cms);
    CREATE INDEX IF NOT EXISTS idx_sr_astro   ON scan_results(astro_detected, astro_version);

    -- One row per manual review action — logged from the local admin UI
    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id       INTEGER NOT NULL REFERENCES sites(id),
      reviewed_at   TEXT    NOT NULL,   -- ISO-8601
      decision      TEXT    NOT NULL,   -- 'remove' | 'keep' | 'rescan' | 'skip' | 'pending' (clears previous)
      cms_confirmed TEXT,               -- CMS name confirmed during review (optional)
      notes         TEXT                -- free-text reviewer notes
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_site ON reviews(site_id, reviewed_at DESC);
  `);
}

// ---------------------------------------------------------------------------
// Write a completed scan run into the DB
// ---------------------------------------------------------------------------

export function writeScanToDb(
	results: CmsResult[],
	output: ResultsFile,
	durationMs: number,
): number {
	const db = openDb();

	try {
		const astroConfirmed = results.filter((r) => r.astroDetected).length;
		const errors = results.filter((r) => r.cms === "Error").length;
		const blocked = results.filter((r) => r.cms === "Blocked").length;
		const forwarded = results.filter((r) => r.cms === "Forwarded").length;

		// ── Insert scan header ──────────────────────────────────────────────────
		const { lastInsertRowid: scanId } = db
			.prepare(
				`INSERT INTO scans
          (scanned_at, source_dir, total_sites, astro_confirmed, errors, blocked, forwarded, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				output.generated,
				output.sourceDir,
				results.length,
				astroConfirmed,
				errors,
				blocked,
				forwarded,
				durationMs,
			);

		// ── Prepared statements ─────────────────────────────────────────────────
		const insertSite = db.prepare(`
      INSERT OR IGNORE INTO sites (url, hostname, first_scan_id, last_scan_id)
      VALUES (?, ?, ?, ?)
    `);
		const touchSite = db.prepare(`
      UPDATE sites SET last_scan_id = ?, removed = 0 WHERE url = ?
    `);
		const getSiteId = db.prepare<[string], { id: number }>(
			"SELECT id FROM sites WHERE url = ?",
		);
		const insertResult = db.prepare(`
      INSERT OR IGNORE INTO scan_results
        (scan_id, site_id, title, cms, cms_type, confidence,
         astro_detected, astro_version, starlight_version, astro_signals,
         final_url, error_message, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

		// ── Write all results in a single transaction ───────────────────────────
		const writeAll = db.transaction(() => {
			for (const r of results) {
				let hostname: string;
				try {
					hostname = new URL(r.url).hostname;
				} catch {
					hostname = r.url;
				}

				insertSite.run(r.url, hostname, scanId, scanId);
				touchSite.run(scanId, r.url);

				const site = getSiteId.get(r.url);
				if (!site) continue; // shouldn't happen

				insertResult.run(
					scanId,
					site.id,
					r.title || null,
					r.cms,
					r.cmsType,
					r.confidence || null,
					r.astroDetected ? 1 : 0,
					r.astroVersion || null,
					r.starlightVersion || null,
					JSON.stringify(r.astroSignals),
					r.finalUrl || null,
					r.error || null,
					r.fetchedAt,
				);
			}
		});

		writeAll();
		return Number(scanId);
	} finally {
		db.close();
	}
}
