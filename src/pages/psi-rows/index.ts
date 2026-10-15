// src/pages/psi-rows/index.ts
// 2026-10-15T00:00:00Z
//
// Pre-rendered <tr> markup for every /psi/ row after page 1, fetched by the
// page when idle (see src/pages/showcase-rows/index.ts for the pattern).
import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import PsiRow from "../../components/showcase/PsiRow.astro";
import { loadPsi } from "../../utils/psiData";

export const prerender = true;

const PAGE_SIZE = 50;

export const GET: APIRoute = async () => {
	const { sites } = loadPsi();
	const container = await AstroContainer.create();
	const rows = await Promise.all(
		sites
			.slice(PAGE_SIZE)
			.map((s) => container.renderToString(PsiRow, { props: { s } })),
	);
	return new Response(rows.join(""), {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
};
