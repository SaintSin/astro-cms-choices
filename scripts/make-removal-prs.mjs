// scripts/make-removal-prs.mjs
// 2026-06-10T00:00:00Z
//
// Creates batched PRs to remove confirmed-gone domains from the Astro showcase.
//
// Reads dns_check_results (latest run, result='gone') from .scan-history.db,
// matches each URL to its YAML file in .showcase-cache, then for each batch:
//   - Creates a branch in .showcase-cache
//   - Deletes the YAML files
//   - Appends domains to blockedOrigins in scripts/update-showcase.mjs
//   - Commits, pushes, and opens a PR via `gh pr create`
//
// Domain removal is verified using DNS over HTTPS (Cloudflare + Google).
// See: https://github.com/SaintSin/astro-cms-choices/blob/main/scripts/dns-check.mjs
//
// Usage:
//   node scripts/make-removal-prs.mjs
//   node scripts/make-removal-prs.mjs --batch-size=50   # sites per PR (default: 50)
//   node scripts/make-removal-prs.mjs --dry-run         # print plan, no git/gh actions
//   node scripts/make-removal-prs.mjs --batch=2         # only create batch N

import Database from "better-sqlite3";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../.scan-history.db");
const CACHE_DIR = resolve(__dirname, "../.showcase-cache");
const SHOWCASE = join(CACHE_DIR, "src/content/showcase");
const BLOCKED_FILE = join(CACHE_DIR, "scripts/update-showcase.mjs");
const UPSTREAM = "withastro/astro.build";
const FORK = "SaintSin/astro.build";
const REPO_LINK =
	"https://github.com/SaintSin/astro-cms-choices/blob/main/scripts/dns-check.mjs";

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, fallback = null) {
	const entry = args.find((a) => a.startsWith(`${name}=`));
	return entry ? entry.slice(name.length + 1) : fallback;
}

const BATCH_SIZE = parseInt(getArg("--batch-size", "50"), 10);
const ONLY_BATCH = getArg("--batch") ? parseInt(getArg("--batch"), 10) : null;
const DRY_RUN = args.includes("--dry-run");

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
	return execSync(cmd, { encoding: "utf8", stdio: "pipe", ...opts }).trim();
}

function hr(c = "─", w = 72) {
	return c.repeat(w);
}

// ── Load gone domains from DB ─────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

const latestRun = db
	.prepare("SELECT id, checked_at FROM dns_check_runs ORDER BY id DESC LIMIT 1")
	.get();

if (!latestRun) {
	console.error("\n  No dns_check_runs found. Run pnpm dns-check first.\n");
	process.exit(1);
}

const goneSites = db
	.prepare(`
	SELECT s.url, s.hostname, sr.title
	FROM dns_check_results r
	JOIN sites s ON s.id = r.site_id
	LEFT JOIN scan_results sr ON sr.site_id = s.id
	  AND sr.scan_id = (SELECT MAX(id) FROM scans)
	WHERE r.result = 'gone'
	  AND r.run_id = ?
	ORDER BY s.hostname
`)
	.all(latestRun.id);

console.log(`\n${hr()}`);
console.log(
	`  MAKE REMOVAL PRs — ${goneSites.length} gone domains from dns-check run #${latestRun.id}`,
);
console.log(
	`  Checked: ${new Date(latestRun.checked_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
);
console.log(`  Batch size: ${BATCH_SIZE}  |  Dry run: ${DRY_RUN}`);
console.log(hr());

// ── Build URL → YAML filename map ─────────────────────────────────────────────

if (!existsSync(SHOWCASE)) {
	console.error(`\n  .showcase-cache not found. Run pnpm detect first.\n`);
	process.exit(1);
}

const yamlFiles = readdirSync(SHOWCASE).filter((f) => f.endsWith(".yml"));
const urlToFile = new Map();
for (const file of yamlFiles) {
	const content = readFileSync(join(SHOWCASE, file), "utf8");
	const m = content.match(/^url:\s*['"]?(https?:\/\/[^\s'"]+)/m);
	if (m) urlToFile.set(m[1], file);
}

// Match gone sites to YAML files
const matched = [];
const unmatched = [];
for (const site of goneSites) {
	const file = urlToFile.get(site.url);
	if (file) matched.push({ ...site, file });
	else unmatched.push(site);
}

console.log(
	`  Matched to YAML: ${matched.length}  |  No YAML found: ${unmatched.length}`,
);
if (unmatched.length) {
	console.log(`\n  Unmatched (already removed or URL mismatch):`);
	for (const s of unmatched) console.log(`    ${s.url}`);
}

if (matched.length === 0) {
	console.log("\n  Nothing to do.\n");
	process.exit(0);
}

// ── Batch ─────────────────────────────────────────────────────────────────────

const batches = [];
for (let i = 0; i < matched.length; i += BATCH_SIZE) {
	batches.push(matched.slice(i, i + BATCH_SIZE));
}
console.log(
	`\n  ${batches.length} batch${batches.length > 1 ? "es" : ""} of up to ${BATCH_SIZE}`,
);

// ── Ensure scripts/ is in sparse checkout ────────────────────────────────────

if (!existsSync(BLOCKED_FILE)) {
	console.log("\n  Adding scripts/ to sparse checkout...");
	if (!DRY_RUN) {
		run(
			`git -C "${CACHE_DIR}" sparse-checkout set --no-cone "src/content/showcase/*.yml" "scripts/update-showcase.mjs"`,
		);
		run(`git -C "${CACHE_DIR}" checkout`);
	}
}

// ── Process each batch ────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

for (let b = 0; b < batches.length; b++) {
	const batchNum = b + 1;
	if (ONLY_BATCH !== null && ONLY_BATCH !== batchNum) continue;

	const batch = batches[b];
	const branch = `chore/remove-gone-domains-batch-${batchNum}-${today}`;

	console.log(`\n${hr("·", 72)}`);
	console.log(
		`  Batch ${batchNum}/${batches.length} — ${batch.length} sites  →  ${branch}`,
	);
	console.log(hr("·", 72));
	for (const s of batch) console.log(`    ${s.hostname}`);

	if (DRY_RUN) continue;

	// ── Git: create branch from latest main ───────────────────────────────────

	run(`git -C "${CACHE_DIR}" fetch origin`);
	run(`git -C "${CACHE_DIR}" checkout -B "${branch}" origin/main`);

	// ── Delete YAML files ─────────────────────────────────────────────────────

	const filePaths = batch.map((s) => `src/content/showcase/${s.file}`);
	run(
		`git -C "${CACHE_DIR}" rm --sparse ${filePaths.map((f) => `"${f}"`).join(" ")}`,
	);

	// ── Update blockedOrigins ─────────────────────────────────────────────────

	const blocked = readFileSync(BLOCKED_FILE, "utf8");
	const entries = batch.map((s) => `\t\t'${s.url}',`).join("\n");
	const comment = `\t\t// ${today} - domain gone, NXDOMAIN confirmed via DoH (dns-check.mjs)`;
	const insertion = `${comment}\n${entries}\n\t],`;

	if (!blocked.includes("\t],\n});")) {
		throw new Error(
			"Could not find blockedOrigins closing bracket — file format may have changed.",
		);
	}
	writeFileSync(
		BLOCKED_FILE,
		blocked.replace("\t],\n});", insertion + "\n});"),
	);
	run(`git -C "${CACHE_DIR}" add scripts/update-showcase.mjs`);

	// ── Commit ────────────────────────────────────────────────────────────────

	const commitMsg = `chore(showcase): remove ${batch.length} sites with expired/deleted domains (batch ${batchNum}/${batches.length})`;
	run(`git -C "${CACHE_DIR}" commit -m "${commitMsg}"`);

	// ── Push to fork ──────────────────────────────────────────────────────────

	run(`git -C "${CACHE_DIR}" push origin "${branch}" --force-with-lease`);

	// ── Build PR body ─────────────────────────────────────────────────────────

	const tableRows = batch
		.map((s) => {
			const label = s.title || s.hostname;
			const isastro = `https://isastro.pages.dev/?url=${s.hostname}`;
			return `| [${label}](${s.url}) | [verify ↗](${isastro}) |`;
		})
		.join("\n");

	const totalBatches = batches.length;
	const prBody = `## Summary

Removes ${batch.length} showcase sites whose domains are confirmed gone (NXDOMAIN on both Cloudflare and Google DNS over HTTPS). Batch ${batchNum} of ${totalBatches}.

All domains verified using \`pnpm dns-check\` ([source](${REPO_LINK})) — queries the scan history database for persistently-erroring sites, then cross-checks each domain against two independent DNS over HTTPS resolvers (Cloudflare + Google). Only domains where both resolvers return NXDOMAIN are flagged as gone.

All removed domains added to \`blockedOrigins\` to prevent the weekly CI from re-checking them.

| Site | isAstro |
| :--- | :--- |
${tableRows}`;

	// ── Print PR command for manual submission ────────────────────────────────

	const prTitle = `chore(showcase): remove ${batch.length} sites with expired/deleted domains (batch ${batchNum}/${totalBatches})`;
	const bodyFile = resolve(__dirname, `../pr-body-batch-${batchNum}.md`);
	writeFileSync(bodyFile, prBody);

	console.log(`\n  ✓ Branch pushed. Open the PR when ready:\n`);
	console.log(`  gh pr create \\`);
	console.log(`    --repo "${UPSTREAM}" \\`);
	console.log(`    --head "${FORK.split("/")[0]}:${branch}" \\`);
	console.log(`    --title "${prTitle}" \\`);
	console.log(`    --body-file "pr-body-batch-${batchNum}.md"\n`);
	console.log(`  PR body saved to: pr-body-batch-${batchNum}.md`);
}

console.log(`\n${hr()}`);
if (DRY_RUN) {
	console.log(`  Dry run complete — no changes made.`);
} else {
	console.log(
		`  Branches pushed. Review the pr-body-batch-*.md files and submit PRs when ready.`,
	);
}
console.log();
