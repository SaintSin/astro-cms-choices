// src/pages/showcase-rows/index.ts
// 2026-10-15T00:00:00Z
//
// Pre-rendered <tr> markup for every showcase row after page 1. The homepage
// fetches this when idle (or on first interaction) instead of inlining ~3.8 MB
// of rows in its own HTML. Same ShowcaseRow component, so styling is identical.

import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import ShowcaseRow from "../../components/showcase/ShowcaseRow.astro";
import { siteMetadata } from "../../config/siteMetadata";
import type { ResultsFile } from "../../types/index";

export const prerender = true;

export const GET: APIRoute = async () => {
	const data = (await import("../../data/cms-results.json"))
		.default as unknown as ResultsFile;
	const pageSize = siteMetadata.showcasePageSize ?? 50;
	const container = await AstroContainer.create();
	const rows = await Promise.all(
		data.results
			.slice(pageSize)
			.map((r) => container.renderToString(ShowcaseRow, { props: { r } })),
	);
	return new Response(rows.join(""), {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
};
