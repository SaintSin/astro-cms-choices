// @ts-check

import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders, svgoOptimizer } from "astro/config";
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
		rustCompiler: true,
		queuedRendering: {
			enabled: true,
		},
	},
	image: {
		responsiveStyles: true,
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: "IBM Plex Sans",
			cssVariable: "--font-ibm-plex",
			weights: ["100 700"], // variable font range
		},
	],
	integrations: [sitemap(), robotsTxt()],
	vite: {
		plugins: [localAdminPlugin()],
	},
	trailingSlash: "always",
	site: "https://astro-what-cms.netlify.app",
});
