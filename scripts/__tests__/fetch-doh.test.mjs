// scripts/__tests__/fetch-doh.test.mjs
// 2026-10-15T00:00:00Z
import assert from "node:assert/strict";
import { test } from "node:test";
import { dohLookup } from "../doh.mjs";
import { fetchWithRetry } from "../fetch-retry.mjs";

const resp = (status, body = {}, headers = {}) => ({
	status,
	ok: status >= 200 && status < 300,
	headers: { get: (k) => headers[k.toLowerCase()] ?? null },
	json: async () => body,
});

test("retries 429 honoring Retry-After, then succeeds", async () => {
	const waits = [];
	const seq = [resp(429, {}, { "retry-after": "3" }), resp(200)];
	const res = await fetchWithRetry("u", {
		fetchFn: async () => seq.shift(),
		sleep: async (ms) => waits.push(ms),
	});
	assert.equal(res.status, 200);
	assert.deepEqual(waits, [3000]);
});

test("retries network errors with backoff, gives up after retries", async () => {
	let calls = 0;
	await assert.rejects(
		fetchWithRetry("u", {
			retries: 2,
			fetchFn: async () => {
				calls++;
				throw new Error("ECONNRESET");
			},
			sleep: async () => {},
		}),
		/ECONNRESET/,
	);
	assert.equal(calls, 3);
});

test("does not retry 400", async () => {
	let calls = 0;
	const res = await fetchWithRetry("u", {
		fetchFn: async () => {
			calls++;
			return resp(400);
		},
		sleep: async () => {},
	});
	assert.equal(res.status, 400);
	assert.equal(calls, 1);
});

const byHost = (cf, goog) => async (url) => {
	const v = url.includes("cloudflare") ? cf : goog;
	if (v === "throw") throw new Error("net");
	return resp(200, { Status: v });
};

test("doh: nxdomain only when both resolvers agree", async () => {
	assert.equal(await dohLookup("x.test", byHost(3, 3)), "nxdomain");
	assert.equal(await dohLookup("x.test", byHost(3, 0)), "error");
	assert.equal(await dohLookup("x.test", byHost(3, "throw")), "error");
	assert.equal(await dohLookup("x.test", byHost(0, 0)), "found");
	assert.equal(await dohLookup("x.test", byHost(0, "throw")), "found");
});
