// scripts/generate-og-cards.mjs
// 2026-07-16T00:00:00Z
//
// Regenerates the social-share OG card PNGs from the HTML templates in
// scripts/og-templates/. Templates live outside public/ so they never ship
// in the build output — they're only ever read by this script (via
// readFileSync + page.setContent()), never served over HTTP. Each template
// has {{TOKEN}} placeholders for the live stats — this script computes
// current numbers from cms-results.json and .scan-history.db, substitutes
// them into the HTML in memory, renders with Playwright, and writes the PNG
// to public/images/social/.
//
// Usage:
//   pnpm generate:og-cards                # regenerate all 3 cards
//   pnpm generate:og-cards -- --card=psi  # home | crux | psi

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DB_PATH = resolve(ROOT, ".scan-history.db");
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const cardFilter = process.argv
	.slice(2)
	.find((a) => a.startsWith("--card="))
	?.slice("--card=".length);

// ── Stat computation ─────────────────────────────────────────────────────────

function homeStats() {
	const data = JSON.parse(
		readFileSync(resolve(ROOT, "src/data/cms-results.json"), "utf8"),
	);
	const results = data.results;
	const total = results.length;
	const astroConfirmed = results.filter((r) => r.astroDetected).length;
	const migratedAway = results.filter(
		(r) => !r.astroDetected && r.cms !== "Error" && r.cms !== "Blocked",
	).length;
	const parkedExpired = results.filter((r) => r.cmsType === "parked").length;

	const count = (type) => results.filter((r) => r.cmsType === type).length;
	const barHeadless = count("headless-cms");
	const barStatic = count("static-gen");
	const barBuilder = count("page-builder");
	const barFullsite = count("full-site");
	// cmsType === "framework" is for sites with no CMS at all besides the
	// framework; most framework detections are the secondary `framework`
	// field (e.g. Next.js next to a CMS) — combine both for the bar.
	const barFramework =
		count("framework") + results.filter((r) => r.framework).length;
	const barRemainder =
		total - (barHeadless + barStatic + barBuilder + barFullsite + barFramework);

	return {
		TOTAL_SITES: total,
		ASTRO_CONFIRMED: astroConfirmed,
		MIGRATED_AWAY: migratedAway,
		PARKED_EXPIRED: parkedExpired,
		BAR_HEADLESS: barHeadless,
		BAR_STATIC: barStatic,
		BAR_BUILDER: barBuilder,
		BAR_FRAMEWORK: barFramework,
		BAR_FULLSITE: barFullsite,
		BAR_REMAINDER: barRemainder,
	};
}

function cruxStats(db) {
	const row = db
		.prepare(
			`WITH latest_d AS (
        SELECT site_id, MAX(run_id) rid FROM crux_results
        WHERE status = 'success' AND form_factor = 'DESKTOP' GROUP BY site_id
      ),
      latest_p AS (
        SELECT site_id, MAX(run_id) rid FROM crux_results
        WHERE status = 'success' AND form_factor = 'PHONE' GROUP BY site_id
      )
      SELECT
        (SELECT COUNT(*) FROM latest_d) AS desktop_sites,
        (SELECT COUNT(*) FROM latest_p) AS phone_sites,
        (SELECT COUNT(*) FROM latest_d l JOIN crux_results c
           ON c.site_id = l.site_id AND c.run_id = l.rid AND c.form_factor = 'DESKTOP'
         WHERE c.cwv_pass = 1) AS desktop_pass,
        (SELECT COUNT(*) FROM latest_p l JOIN crux_results c
           ON c.site_id = l.site_id AND c.run_id = l.rid AND c.form_factor = 'PHONE'
         WHERE c.cwv_pass = 1) AS phone_pass`,
		)
		.get();

	return {
		DESKTOP_SITES: row.desktop_sites,
		PHONE_SITES: row.phone_sites,
		DESKTOP_CWV_PASS: row.desktop_pass,
		PHONE_CWV_PASS: row.phone_pass,
		DESKTOP_CWV_FAIL: row.desktop_sites - row.desktop_pass,
	};
}

function psiStats(db) {
	const row = db
		.prepare(
			`WITH latest_m AS (
        SELECT site_id, MAX(run_id) rid FROM psi_results
        WHERE status = 'success' AND strategy = 'mobile' GROUP BY site_id
      ),
      latest_d AS (
        SELECT site_id, MAX(run_id) rid FROM psi_results
        WHERE status = 'success' AND strategy = 'desktop' GROUP BY site_id
      )
      SELECT
        (SELECT COUNT(*) FROM latest_m) AS mobile_tested,
        (SELECT COUNT(*) FROM latest_d) AS desktop_tested,
        (SELECT COUNT(*) FROM latest_m l JOIN psi_results p
           ON p.site_id = l.site_id AND p.run_id = l.rid AND p.strategy = 'mobile'
         WHERE p.performance >= 90) AS mobile_high,
        (SELECT COUNT(*) FROM latest_d l JOIN psi_results p
           ON p.site_id = l.site_id AND p.run_id = l.rid AND p.strategy = 'desktop'
         WHERE p.performance >= 90) AS desktop_high`,
		)
		.get();

	// Decorative third segment: desktop-tested sites that didn't hit perf ≥ 90.
	const barRemainder = row.desktop_tested - row.desktop_high;

	return {
		MOBILE_TESTED: row.mobile_tested,
		DESKTOP_TESTED: row.desktop_tested,
		MOBILE_PERF_HIGH: row.mobile_high,
		DESKTOP_PERF_HIGH: row.desktop_high,
		PSI_BAR_REMAINDER: barRemainder,
	};
}

// ── Render ────────────────────────────────────────────────────────────────────

function substitute(html, tokens) {
	let out = html;
	// CSS `flex: N` needs a raw integer — a comma-formatted value like "1,902"
	// is invalid and silently drops the flex-basis, collapsing the segment.
	// Handle these first with an unformatted number, then format everything
	// else (visible stat text) with commas.
	out = out.replace(/flex:\s*\{\{([A-Z_]+)\}\}/g, (_match, key) => {
		if (!(key in tokens))
			throw new Error(`Unknown token in flex value: ${key}`);
		return `flex: ${tokens[key]}`;
	});
	for (const [key, value] of Object.entries(tokens)) {
		out = out.replaceAll(`{{${key}}}`, value.toLocaleString("en-US"));
	}
	const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
	if (leftover) {
		throw new Error(
			`Unsubstituted token(s) left in template: ${leftover.join(", ")}`,
		);
	}
	return out;
}

async function renderCard(browser, { file, outFile, tokens }) {
	const templatePath = resolve(ROOT, "scripts/og-templates", file);
	const html = substitute(readFileSync(templatePath, "utf8"), tokens);

	const page = await browser.newPage({
		viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
		deviceScaleFactor: 1,
	});
	await page.setContent(html, { waitUntil: "networkidle" });
	const outPath = resolve(ROOT, "public/images/social", outFile);
	await page.screenshot({ path: outPath });
	await page.close();
	console.log(`  ✓ ${file} → public/images/social/${outFile}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

const cards = [
	{
		name: "home",
		file: "og-card.html",
		outFile: "og-home.png",
		tokens: homeStats(),
	},
	{
		name: "crux",
		file: "og-card-crux.html",
		outFile: "og-crux.png",
		tokens: cruxStats(db),
	},
	{
		name: "psi",
		file: "og-card-psi.html",
		outFile: "og-psi.png",
		tokens: psiStats(db),
	},
].filter((c) => !cardFilter || c.name === cardFilter);

db.close();

if (cards.length === 0) {
	console.error(
		`No card matches --card=${cardFilter} (expected: home, crux, psi)`,
	);
	process.exit(1);
}

console.log("\nGenerating OG cards...");
const browser = await chromium.launch();
for (const card of cards) {
	await renderCard(browser, card);
}
await browser.close();
console.log("Done.\n");
