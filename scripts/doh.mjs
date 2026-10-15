// scripts/doh.mjs
// 2026-10-15T00:00:00Z
//
// DNS-over-HTTPS lookup against two resolvers. "nxdomain" is only returned
// when BOTH resolvers say so — removal PRs claim that, and a single flaky or
// poisoned resolver must not be able to condemn a live site.

export const DOH_PROVIDERS = [
	"https://cloudflare-dns.com/dns-query",
	"https://dns.google/resolve",
];

// One resolver, one retry. Returns 'nxdomain' | 'found' | 'error'.
async function askOne(base, hostname, fetchFn) {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await fetchFn(`${base}?name=${hostname}&type=A`, {
				headers: { Accept: "application/dns-json" },
				signal: AbortSignal.timeout(5000),
			});
			if (!res.ok) continue;
			const { Status } = await res.json();
			if (Status === 3) return "nxdomain";
			if (Status === 0) return "found"; // NOERROR, with or without A records
		} catch {}
	}
	return "error";
}

// Returns: 'nxdomain' | 'found' | 'error' (error = inconclusive/disagreement)
export async function dohLookup(hostname, fetchFn = fetch) {
	const answers = await Promise.all(
		DOH_PROVIDERS.map((p) => askOne(p, hostname, fetchFn)),
	);
	if (answers.every((a) => a === "nxdomain")) return "nxdomain";
	if (answers.includes("found") && !answers.includes("nxdomain"))
		return "found";
	return "error";
}
