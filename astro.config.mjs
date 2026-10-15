// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders, svgoOptimizer } from "astro/config";
import llmsTxt from "astro-llms-md";
import robotsTxt from "astro-robots-txt";

// ── Local admin review UI ──────────────────────────────────────────────────────
// Mounted at /admin during `pnpm dev` only — never included in the production build.
// Reads/writes .scan-history.db via scripts/admin-handler.mjs.

/** @returns {import('vite').Plugin} */
function localAdminPlugin() {
	return {
		name: "local-admin",
		apply: "serve", // dev-server only — excluded from builds
		async configureServer(server) {
			// Use a file:// URL so Node's native ESM loader handles the import,
			// bypassing Vite's module resolver — required for native addons like better-sqlite3.
			const { pathToFileURL } = await import("node:url");
			const { resolve } = await import("node:path");
			const handlerUrl = pathToFileURL(
				resolve("scripts/admin-handler.mjs"),
			).href;
			const { handleRequest } = await import(handlerUrl);

			// Intercept at the raw HTTP level — BEFORE Vite/Astro's connect middleware stack.
			// Astro's trailingSlashMiddleware (trailingSlash: "always") rejects /admin/api/*
			// routes with 404 before our connect middleware can run. By stealing the 'request'
			// event on 'listening' we bypass that entirely: /admin routes go to our handler,
			// everything else falls through to connect as normal.
			server.httpServer?.once("listening", () => {
				const addr = server.httpServer.address();
				const port = typeof addr === "object" ? addr?.port : 4321;
				console.log(`  ➜ Admin UI:  http://localhost:${port}/admin`);

				const connectListeners = server.httpServer.rawListeners("request");
				server.httpServer.removeAllListeners("request");
				server.httpServer.on("request", (req, res) => {
					if (req.url?.startsWith("/admin")) {
						handleRequest(req, res, () => {});
					} else {
						for (const fn of connectListeners)
							fn.call(server.httpServer, req, res);
					}
				});
			});
		},
	};
}

// https://astro.build/config
export default defineConfig({
	experimental: {
		svgOptimizer: svgoOptimizer(),
	},
	image: {
		responsiveStyles: true,
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: "IBM Plex Sans",
			cssVariable: "--font-plex-sans",
			weights: ["300 700"], // variable font range
			styles: ["normal"],
			subsets: ["latin"],
			// The body font is preloaded; "optional" means a slow first load keeps
			// the size-adjusted fallback instead of swapping mid-render, which
			// reflowed the /psi/ intro on mobile (CLS 0.10). Cached on repeat views.
			display: "optional",
		},
		{
			provider: fontProviders.google(),
			name: "IBM Plex Serif",
			cssVariable: "--font-plex-serif",
			// No variable file, so each weight is its own file. Only these three
			// are used anywhere (h1/h2/h3 = 700, the h1 .muted span = 400, /insights/
			// section headings = 600).
			weights: ["400", "600", "700"],
			styles: ["normal"],
			subsets: ["latin"],
		},
		{
			provider: fontProviders.google(),
			name: "IBM Plex Mono",
			cssVariable: "--font-plex-mono",
			weights: ["400"], // inline <code> on the notes article only
			styles: ["normal"],
			subsets: ["latin"],
		},
	],
	integrations: [
		sitemap(),
		llmsTxt({
			generateMarkdown: true,
		}),
		robotsTxt(),
		mdx(),
	],
	vite: {
		plugins: [localAdminPlugin()],
	},
	build: {
		inlineStylesheets: "always",
	},
	trailingSlash: "always",
	site: "https://astro-what-cms.netlify.app",
});
