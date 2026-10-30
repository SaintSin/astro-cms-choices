// scripts/__tests__/theme-cms.test.ts
// 2026-10-30T00:00:00Z
import assert from "node:assert/strict";
import { test } from "node:test";
import { themeCms } from "../theme-cms.ts";

test("names a CMS the theme mentions", () => {
	assert.equal(themeCms("A blog built with TinaCMS and Astro"), "TinaCMS");
	assert.equal(
		themeCms("Works with Sanity.io and Contentful"),
		"Contentful,Sanity",
	);
});

test("ambiguous words need CMS context", () => {
	assert.equal(
		themeCms("Run a sanity check on the Ghost in the machine"),
		null,
	);
	assert.equal(themeCms("Uses the Ghost Content API"), "Ghost");
});

test("no CMS mentioned", () => {
	assert.equal(themeCms("A fast portfolio theme"), null);
});
