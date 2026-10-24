// scripts/__tests__/fingerprint.test.ts
// 2026-10-15T00:00:00Z
import assert from "node:assert/strict";
import { test } from "node:test";
import { fingerprint } from "../detect-cms.ts";

const page = (body: string, title = "Home") =>
	`<html><head><title>${title}</title></head><body>${body}</body></html>`;
const cf =
	'<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>';

test("challenge-platform script on a normal page is not a bot wall", () => {
	const html = page(`${cf}<img src="https://cdn.sanity.io/images/x/y.jpg">`);
	const r = fingerprint(html, { "cf-ray": "abc" }, "https://a.test/");
	assert.notEqual(r?.cms, "Blocked");
});

test("challenge-platform alone does not yield Blocked", () => {
	const r = fingerprint(page(cf), { "cf-ray": "abc" }, "https://a.test/");
	assert.notEqual(r?.cms, "Blocked");
});

test("real Cloudflare interstitial is Blocked", () => {
	const html = page(
		"<script>window._cf_chl_opt={}</script>",
		"Just a moment...",
	);
	const r = fingerprint(html, { "cf-ray": "abc" }, "https://a.test/");
	assert.equal(r?.cms, "Blocked");
});

test("cf-mitigated: challenge header is Blocked", () => {
	const r = fingerprint(
		page("x"),
		{ "cf-mitigated": "challenge" },
		"https://a.test/",
	);
	assert.equal(r?.cms, "Blocked");
});

test("/_emdash/ media path is EmDash", () => {
	const html = page('<img src="/_emdash/api/media/file/abc.png">');
	assert.equal(fingerprint(html, {}, "https://a.test/")?.cms, "EmDash");
});

test("EmDash server-timing header is EmDash", () => {
	const headers = { "server-timing": 'rt.seedcheck;dur=41;desc="Auto-seed"' };
	assert.equal(
		fingerprint(page("x"), headers, "https://a.test/")?.cms,
		"EmDash",
	);
});

test("plain page is not EmDash", () => {
	assert.notEqual(fingerprint(page("x"), {}, "https://a.test/")?.cms, "EmDash");
});
