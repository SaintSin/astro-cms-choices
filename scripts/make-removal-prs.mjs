// scripts/make-removal-prs.mjs
// 2026-08-14T00:00:00Z
//
// Creates batched PRs to remove showcase sites that are no longer valid Astro
// entries — either confirmed-gone domains (the original DNS-check flow) or an
// arbitrary reason-tagged batch supplied via --input (parked domains, sites
// that migrated to another framework/CMS, sites that now just redirect
// elsewhere, etc).
//
// For each batch:
//   - Creates a branch in .showcase-cache
//   - Deletes the YAML files
//   - Appends domains to blockedOrigins in scripts/update-showcase.mjs
//   - Commits, pushes, and prints the `gh pr create` command
//
// Default mode reads dns_check_results (latest run, result='gone') from
// .scan-history.db. See: https://github.com/SaintSin/astro-cms-choices/blob/main/scripts/dns-check.mjs
//
// --input mode reads a JSON file instead:
//   {
//     "reason": "parked-domains",                 // used in branch name
//     "prTitle": "remove 7 sites with parked or expired domains",
//     "summary": "One-paragraph explanation of how these were verified.",
//     "commitPrefix": "chore(showcase): remove",   // optional, defaults shown
//     "sites": [
//       { "url": "https://example.com/", "title": "Example", "redirectsTo": "https://other.com/" }
//     ]
//   }
// `redirectsTo` is optional per-site — if any site in the batch has it, the
// PR body uses a 3-column (Site | Redirects to | isAstro) table, otherwise
// a 2-column (Site | isAstro) table, matching prior PR conventions.
//
// Usage:
//   node scripts/make-removal-prs.mjs
//   node scripts/make-removal-prs.mjs --batch-size=50        # sites per PR (default: 50)
//   node scripts/make-removal-prs.mjs --dry-run               # print plan, no git/gh actions
//   node scripts/make-removal-prs.mjs --batch=2                # only create batch N
//   node scripts/make-removal-prs.mjs --input=batch.json       # reason-tagged batch instead of dns-check gone
//   node scripts/make-removal-prs.mjs --input=batch.json --dry-run

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

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
const INPUT_FILE = getArg("--input");

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
	return execSync(cmd, { encoding: "utf8", stdio: "pipe", ...opts }).trim();
}

function hr(c = "─", w = 72) {
	return c.repeat(w);
}

// ── Load sites: either a reason-tagged --input batch, or dns-check "gone" ──────

let goneSites;
let batchMeta = null;

if (INPUT_FILE) {
	const inputPath = resolve(process.cwd(), INPUT_FILE);
	if (!existsSync(inputPath)) {
		console.error(`\n  --input file not found: ${inputPath}\n`);
		process.exit(1);
	}
	batchMeta = JSON.parse(readFileSync(inputPath, "utf8"));
	if (
		!batchMeta.reason ||
		!batchMeta.prTitle ||
		!Array.isArray(batchMeta.sites)
	) {
		console.error(
			`\n  --input file must have "reason", "prTitle", and a "sites" array.\n`,
		);
		process.exit(1);
	}
	goneSites = batchMeta.sites.map((s) => ({
		url: s.url,
		hostname: s.hostname ?? new URL(s.url).hostname,
		title: s.title ?? null,
		redirectsTo: s.redirectsTo ?? null,
	}));

	console.log(`\n${hr()}`);
	console.log(
		`  MAKE REMOVAL PRs — ${goneSites.length} sites from --input (reason: ${batchMeta.reason})`,
	);
	console.log(`  Batch size: ${BATCH_SIZE}  |  Dry run: ${DRY_RUN}`);
	console.log(hr());
} else {
	const db = new Database(DB_PATH, { readonly: true });

	const latestRun = db
		.prepare(
			"SELECT id, checked_at FROM dns_check_runs ORDER BY id DESC LIMIT 1",
		)
		.get();

	if (!latestRun) {
		console.error("\n  No dns_check_runs found. Run pnpm dns-check first.\n");
		process.exit(1);
	}

	goneSites = db
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
	db.close();

	console.log(`\n${hr()}`);
	console.log(
		`  MAKE REMOVAL PRs — ${goneSites.length} gone domains from dns-check run #${latestRun.id}`,
	);
	console.log(
		`  Checked: ${new Date(latestRun.checked_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
	);
	console.log(`  Batch size: ${BATCH_SIZE}  |  Dry run: ${DRY_RUN}`);
	console.log(hr());
}

// ── Build URL → YAML filename map ─────────────────────────────────────────────

if (!existsSync(SHOWCASE)) {
	console.error(`\n  .showcase-cache not found. Run pnpm detect first.\n`);
	process.exit(1);
}

const yamlFiles = readdirSync(SHOWCASE).filter((f) => f.endsWith(".yml"));
const urlToFile = new Map();
for (const file of yamlFiles) {
	const content = readFileSync(join(SHOWCASE, file), "utf8");
	const urlMatch = content.match(/^url:\s*['"]?(https?:\/\/[^\s'"]+)/m);
	// Image filename doesn't always match the YAML basename (e.g.
	// web.koyu.space's entry is koyu.yml / koyu.webp) — read it from the
	// YAML itself rather than assuming, so the screenshot always gets
	// deleted alongside the metadata, not left orphaned.
	const imageMatch = content.match(/^image:\s*['"]?\.\/([^\s'"]+)/m);
	if (urlMatch) urlToFile.set(urlMatch[1], { file, image: imageMatch?.[1] });
}

// Match gone sites to YAML files
const matched = [];
const unmatched = [];
for (const site of goneSites) {
	const entry = urlToFile.get(site.url);
	if (entry) matched.push({ ...site, file: entry.file, image: entry.image });
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

// ── Ensure YAML + webp images + scripts/ are in sparse checkout ──────────────
// Always re-assert this (not just when missing) — a prior manual checkout
// elsewhere in the workflow can narrow the sparse-checkout back down, and a
// missing "*.webp" here means screenshots silently don't get deleted below.

if (!DRY_RUN) {
	run(
		`git -C "${CACHE_DIR}" sparse-checkout set --no-cone "src/content/showcase/*.yml" "src/content/showcase/*.webp" "scripts/update-showcase.mjs"`,
	);
	run(`git -C "${CACHE_DIR}" checkout`);
}

// ── Process each batch ────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

for (let b = 0; b < batches.length; b++) {
	const batchNum = b + 1;
	if (ONLY_BATCH !== null && ONLY_BATCH !== batchNum) continue;

	const batch = batches[b];
	const branchSlug = batchMeta ? batchMeta.reason : "remove-gone-domains";
	const branch = `chore/${branchSlug}-batch-${batchNum}-${today}`;

	console.log(`\n${hr("·", 72)}`);
	console.log(
		`  Batch ${batchNum}/${batches.length} — ${batch.length} sites  →  ${branch}`,
	);
	console.log(hr("·", 72));
	for (const s of batch) console.log(`    ${s.hostname}`);

	// ── Build PR title/body up front (used for both dry-run preview and the real PR) ──

	const totalBatches = batches.length;
	const batchSuffix =
		totalBatches > 1 ? ` (batch ${batchNum}/${totalBatches})` : "";

	const hasRedirects = batch.some((s) => s.redirectsTo);
	const tableHeader = hasRedirects
		? "| Site | Redirects to | isAstro |\n| :--- | :--- | :--- |"
		: "| Site | isAstro |\n| :--- | :--- |";
	const tableRows = batch
		.map((s) => {
			// Escape literal pipes in titles — otherwise they're parsed as
			// extra table columns and silently break the row (e.g. "Deskpro
			// | Helpdesk Software | Cloud or On-Premise").
			const label = (s.title || s.hostname).replaceAll("|", "\\|");
			if (hasRedirects) {
				// Verify link should test the actual redirect destination, not
				// the original (redirecting) hostname — the claim being made
				// is "the destination isn't Astro," so that's what a reviewer
				// needs to check directly rather than trust redirect-following.
				const destHostname = s.redirectsTo
					? new URL(s.redirectsTo).hostname
					: s.hostname;
				const dest = s.redirectsTo
					? `[${destHostname}](${s.redirectsTo})`
					: "—";
				const isastro = `[verify ↗](https://isastro.pages.dev/?url=${destHostname})`;
				return `| [${label}](${s.url}) | ${dest} | ${isastro} |`;
			}
			const isastro = `[verify ↗](https://isastro.pages.dev/?url=${s.hostname})`;
			return `| [${label}](${s.url}) | ${isastro} |`;
		})
		.join("\n");

	const prBody = batchMeta
		? `## Summary

${batchMeta.summary ?? `Removes ${batch.length} showcase sites — ${batchMeta.reason.replace(/-/g, " ")}.`}${totalBatches > 1 ? ` Batch ${batchNum} of ${totalBatches}.` : ""}

All removed domains added to \`blockedOrigins\` to prevent the weekly CI from re-adding them.

${tableHeader}
${tableRows}`
		: `## Summary

Removes ${batch.length} showcase sites whose domains are confirmed gone (NXDOMAIN on both Cloudflare and Google DNS over HTTPS).${totalBatches > 1 ? ` Batch ${batchNum} of ${totalBatches}.` : ""}

All domains verified using \`pnpm dns-check\` ([source](${REPO_LINK})) — queries the scan history database for persistently-erroring sites, then cross-checks each domain against two independent DNS over HTTPS resolvers (Cloudflare + Google). Only domains where both resolvers return NXDOMAIN are flagged as gone.

All removed domains added to \`blockedOrigins\` to prevent the weekly CI from re-checking them.

${tableHeader}
${tableRows}`;

	const prTitle = batchMeta
		? `chore(showcase): ${batchMeta.prTitle}${batchSuffix}`
		: `chore(showcase): remove ${batch.length} sites with expired/deleted domains${batchSuffix}`;
	const bodyFileName = `pr-body-${branchSlug}-${batchNum}.md`;
	const bodyFile = resolve(__dirname, `..`, bodyFileName);
	writeFileSync(bodyFile, prBody);
	console.log(`\n  PR title: ${prTitle}`);
	console.log(`  PR body saved to: ${bodyFileName} (${prBody.length} chars)`);

	if (DRY_RUN) continue;

	// ── Git: create branch from latest main ───────────────────────────────────

	run(`git -C "${CACHE_DIR}" fetch origin`);
	run(`git -C "${CACHE_DIR}" checkout -B "${branch}" origin/main`);

	// ── Delete YAML files + their screenshot images ───────────────────────────

	const filePaths = batch.flatMap((s) => {
		const paths = [`src/content/showcase/${s.file}`];
		if (s.image) paths.push(`src/content/showcase/${s.image}`);
		return paths;
	});
	const missingImages = batch.filter((s) => !s.image);
	if (missingImages.length) {
		console.log(
			`\n  ⚠ No image: field found for ${missingImages.length} site(s) — check these YAMLs by hand:`,
		);
		for (const s of missingImages) console.log(`    ${s.hostname} (${s.file})`);
	}
	run(
		`git -C "${CACHE_DIR}" rm --sparse ${filePaths.map((f) => `"${f}"`).join(" ")}`,
	);

	// ── Update blockedOrigins ─────────────────────────────────────────────────

	const blocked = readFileSync(BLOCKED_FILE, "utf8");
	const entries = batch.map((s) => `\t\t'${s.url}',`).join("\n");
	const commentText = batchMeta
		? `${today} - ${batchMeta.reason.replace(/-/g, " ")}`
		: `${today} - domain gone, NXDOMAIN confirmed via DoH (dns-check.mjs)`;
	const comment = `\t\t// ${commentText}`;
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

	const commitMsg = batchMeta
		? `chore(showcase): ${batchMeta.prTitle}${batchSuffix}`
		: `chore(showcase): remove ${batch.length} sites with expired/deleted domains${batchSuffix}`;
	run(`git -C "${CACHE_DIR}" commit -m "${commitMsg}"`);

	// ── Push to fork ──────────────────────────────────────────────────────────

	run(`git -C "${CACHE_DIR}" push origin "${branch}" --force-with-lease`);

	console.log(`\n  ✓ Branch pushed. Open the PR when ready:\n`);
	console.log(`  gh pr create \\`);
	console.log(`    --repo "${UPSTREAM}" \\`);
	console.log(`    --head "${FORK.split("/")[0]}:${branch}" \\`);
	console.log(`    --title "${prTitle}" \\`);
	console.log(`    --body-file "${bodyFileName}"\n`);
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
