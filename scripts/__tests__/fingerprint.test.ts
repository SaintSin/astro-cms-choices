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
