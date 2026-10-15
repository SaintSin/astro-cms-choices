// scripts/fetch-retry.mjs
// 2026-10-15T00:00:00Z
//
// fetch() with retry/backoff for rate limits (429), server errors (5xx) and
// network failures. Honors Retry-After. Returns the final Response (which may
// still be !ok once retries are exhausted) or throws the last network error.

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

export async function fetchWithRetry(
	url,
	{
		retries = 4,
		baseMs = 2000,
		maxMs = 60_000,
		fetchFn = fetch,
		sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
	} = {},
) {
	for (let attempt = 0; ; attempt++) {
		let res;
		try {
			res = await fetchFn(url);
		} catch (err) {
			if (attempt >= retries) throw err;
			await sleep(Math.min(maxMs, baseMs * 2 ** attempt));
			continue;
		}
		if (!RETRY_STATUSES.has(res.status) || attempt >= retries) return res;
		const retryAfter = Number(res.headers?.get?.("retry-after"));
		const wait =
			Number.isFinite(retryAfter) && retryAfter > 0
				? retryAfter * 1000
				: baseMs * 2 ** attempt;
		await sleep(Math.min(maxMs, wait));
	}
}
