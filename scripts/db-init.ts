// scripts/db-init.ts
// 2026-05-27T00:00:00Z
//
// Creates the .scan-history.db file and all tables (idempotent — safe to re-run).
// Run once before your first scan, or any time to verify the DB is healthy.
//
// Usage:
//   pnpm db:init

import { existsSync } from "node:fs";
import { DB_PATH, openDb } from "./db-utils.ts";

const existed = existsSync(DB_PATH);
const db = openDb();

// Quick health check — count rows in each table
const scanCount = (
	db.prepare("SELECT COUNT(*) as n FROM scans").get() as { n: number }
).n;
const siteCount = (
	db.prepare("SELECT COUNT(*) as n FROM sites").get() as { n: number }
).n;
const resultCount = (
	db.prepare("SELECT COUNT(*) as n FROM scan_results").get() as { n: number }
).n;

db.close();

if (existed) {
	console.log(`✓ DB already exists — ${DB_PATH}`);
} else {
	console.log(`✓ DB created — ${DB_PATH}`);
}

console.log(
	`  Tables: scans (${scanCount}), sites (${siteCount}), scan_results (${resultCount})`,
);
console.log(`\nReady. Run 'pnpm detect' to populate it.`);
