// src/pages/crux-rows/index.ts
// 2026-10-15T00:00:00Z
//
// Pre-rendered <tr> markup for every /crux/ row after page 1, fetched by the
// page when idle (see src/pages/showcase-rows/index.ts for the pattern).
import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import CruxRow from "../../components/showcase/CruxRow.astro";
import { loadCrux } from "../../utils/cruxData";

export const prerender = true;

const PAGE_SIZE = 50;

export const GET: APIRoute = async () => {
	const { sites } = loadCrux();
	const container = await AstroContainer.create();
	const rows = await Promise.all(
		sites
			.slice(PAGE_SIZE)
			.map((s) => container.renderToString(CruxRow, { props: { s } })),
	);
	return new Response(rows.join(""), {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
};
