// netlify/functions/pandalytics.ts
// 2026-05-20T00:00:00Z

import type { Handler, HandlerEvent } from "@netlify/functions";

interface MetricData {
	session_id: string;
	site_id: string;
	url: string;
	path?: string;
	referrer?: string;
	country_code?: string;
	screen_width?: number;
	screen_height?: number;
	user_agent?: string;
	browser?: string;
	lcp?: number;
	cls?: number;
	fcp?: number;
	ttfb?: number;
	inp?: number;
  duration_ms?: number;
}

// Truncate strings to prevent oversized payloads
function truncate(
	val: string | undefined | null,
	maxLen: number,
): string | null {
	if (!val) return null;
	return val.length > maxLen ? val.slice(0, maxLen) : val;
}

// Parse browser from user agent
function parseBrowser(userAgent: string | null | undefined): string {
	if (!userAgent) return "Unknown";
	const ua = userAgent.toLowerCase();

	if (ua.includes("firefox/")) {
		const version = userAgent.match(/firefox\/(\d+)/i);
		return `Firefox ${version ? version[1] : ""}`;
	} else if (ua.includes("edg/")) {
		const version = userAgent.match(/edg\/(\d+)/i);
		return `Edge ${version ? version[1] : ""}`;
	} else if (ua.includes("chrome/") && !ua.includes("edg")) {
		const version = userAgent.match(/chrome\/(\d+)/i);
		return `Chrome ${version ? version[1] : ""}`;
	} else if (ua.includes("safari/") && !ua.includes("chrome")) {
		const version = userAgent.match(/version\/(\d+)/i);
		return `Safari ${version ? version[1] : ""}`;
	}
	return "Other";
}

export const handler: Handler = async (event: HandlerEvent) => {
	const method = event.httpMethod;

	if (method !== "POST") {
		return {
			statusCode: 405,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "Method Not Allowed" }),
		};
	}

	let bodyData: MetricData;
	try {
		bodyData = JSON.parse(event.body || "{}") as MetricData;
	} catch {
		return {
			statusCode: 400,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "Invalid JSON" }),
		};
	}

	const {
		session_id,
		site_id,
		url,
		path,
		referrer,
		country_code,
		screen_width,
		screen_height,
		user_agent,
		browser: clientBrowser,
		lcp,
		cls,
		fcp,
		ttfb,
		inp,
		duration_ms,
	} = bodyData;

	// Extract country from Netlify headers if not provided in data
	const finalCountryCode = country_code || (event.headers["x-country"] ?? null);

	if (!session_id || !site_id || !url) {
		return {
			statusCode: 400,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				error: "Missing required fields: session_id, site_id, url",
			}),
		};
	}

	// Use client-sent browser if available, fallback to server-side parsing
	const browser = clientBrowser || parseBrowser(user_agent);
	const timestamp = Date.now();

	// SQL for upsert session
	const sessionSql = `
    INSERT INTO sessions (
      session_id, site_id, start_time, country_code,
      screen_width, screen_height, user_agent, browser
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      country_code = COALESCE(country_code, EXCLUDED.country_code),
      screen_width = COALESCE(screen_width, EXCLUDED.screen_width),
      screen_height = COALESCE(screen_height, EXCLUDED.screen_height),
      user_agent = COALESCE(user_agent, EXCLUDED.user_agent),
      browser = COALESCE(browser, EXCLUDED.browser),
      updated_at = strftime('%s', 'now') * 1000
  `;

	// SQL for pageview
	const pageviewSql = `
    INSERT INTO pageviews (
      session_id, url, path, referrer, timestamp,
      lcp, cls, fcp, ttfb, inp, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

	const sessionParams = [
		truncate(session_id, 100),
		truncate(site_id, 200),
		timestamp,
		truncate(finalCountryCode, 10),
		screen_width ?? null,
		screen_height ?? null,
		truncate(user_agent, 500),
		truncate(browser, 50),
	];

	const pageviewParams = [
		truncate(session_id, 100),
		truncate(url, 2000),
		truncate(path, 500),
		truncate(referrer, 2000),
		timestamp,
		lcp ?? null,
		cls ?? null,
		fcp ?? null,
		ttfb ?? null,
		inp ?? null,
		duration_ms ?? null,
	];

	// Check required environment variables
	if (
		!process.env.PANDALYTICS_TURSO_REST_ENDPOINT ||
		!process.env.PANDALYTICS_TURSO_API_TOKEN
	) {
		console.error("Missing required environment variables");
		return {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "Server configuration error" }),
		};
	}

	try {
		const requestBody = {
			statements: [
				{ q: sessionSql, params: sessionParams },
				{ q: pageviewSql, params: pageviewParams },
			],
		};

		const response = await fetch(process.env.PANDALYTICS_TURSO_REST_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.PANDALYTICS_TURSO_API_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const text = await response.text();
			console.error("Database error:", response.status, text);
			return {
				statusCode: 500,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Database error" }),
			};
		}

		console.log("Pageview recorded:", path || url);
		return {
			statusCode: 200,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ok: true }),
		};
	} catch (err) {
		console.error("Fetch error:", err);
		return {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
