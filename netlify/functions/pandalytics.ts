// netlify/functions/pandalytics.ts
// 2026-06-08T00:00:00Z

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

const JSON_HEADERS = { "Content-Type": "application/json" };

function truncate(
	val: string | undefined | null,
	maxLen: number,
): string | null {
	if (!val) return null;
	return val.length > maxLen ? val.slice(0, maxLen) : val;
}

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

function parseBody(raw: string | null): MetricData | null {
	try {
		return JSON.parse(raw || "{}") as MetricData;
	} catch {
		return null;
	}
}

function buildStatements(
	data: MetricData,
	countryCode: string | null,
	timestamp: number,
) {
	const browser = data.browser || parseBrowser(data.user_agent);

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

	const pageviewSql = `
    INSERT INTO pageviews (
      session_id, url, path, referrer, timestamp,
      lcp, cls, fcp, ttfb, inp, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

	return [
		{
			q: sessionSql,
			params: [
				truncate(data.session_id, 100),
				truncate(data.site_id, 200),
				timestamp,
				truncate(countryCode, 10),
				data.screen_width ?? null,
				data.screen_height ?? null,
				truncate(data.user_agent, 500),
				truncate(browser, 50),
			],
		},
		{
			q: pageviewSql,
			params: [
				truncate(data.session_id, 100),
				truncate(data.url, 2000),
				truncate(data.path, 500),
				truncate(data.referrer, 2000),
				timestamp,
				data.lcp ?? null,
				data.cls ?? null,
				data.fcp ?? null,
				data.ttfb ?? null,
				data.inp ?? null,
				data.duration_ms ?? null,
			],
		},
	];
}

async function writeTurso(
	endpoint: string,
	token: string,
	statements: object[],
) {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ statements }),
	});

	if (!response.ok) {
		const text = await response.text();
		console.error("Database error:", response.status, text);
		return {
			statusCode: 500,
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: "Database error" }),
		};
	}
	return null;
}

export const handler: Handler = async (event: HandlerEvent) => {
	if (event.httpMethod !== "POST") {
		return {
			statusCode: 405,
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: "Method Not Allowed" }),
		};
	}

	const data = parseBody(event.body);
	if (!data) {
		return {
			statusCode: 400,
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: "Invalid JSON" }),
		};
	}

	const { session_id, site_id, url, path } = data;
	if (!session_id || !site_id || !url) {
		return {
			statusCode: 400,
			headers: JSON_HEADERS,
			body: JSON.stringify({
				error: "Missing required fields: session_id, site_id, url",
			}),
		};
	}

	const endpoint = process.env.PANDALYTICS_TURSO_REST_ENDPOINT;
	const token = process.env.PANDALYTICS_TURSO_API_TOKEN;
	if (!endpoint || !token) {
		console.error("Missing required environment variables");
		return {
			statusCode: 500,
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: "Server configuration error" }),
		};
	}

	const countryCode = data.country_code || (event.headers["x-country"] ?? null);
	const statements = buildStatements(data, countryCode, Date.now());

	try {
		const dbError = await writeTurso(endpoint, token, statements);
		if (dbError) return dbError;
		console.log("Pageview recorded:", path || url);
		return {
			statusCode: 200,
			headers: JSON_HEADERS,
			body: JSON.stringify({ ok: true }),
		};
	} catch (err) {
		console.error("Fetch error:", err);
		return {
			statusCode: 500,
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
