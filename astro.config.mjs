// @ts-check

import sitemap from "@astrojs/sitemap";
import { defineConfig, svgoOptimizer } from "astro/config";
import robotsTxt from "astro-robots-txt";

// ── Local admin review UI ──────────────────────────────────────────────────────
// Mounted at /admin during `pnpm dev` only — never included in the production build.
// Reads/writes .scan-history.db via scripts/admin-handler.mjs.

/** @returns {import('vite').Plugin} */
function localAdminPlugin() {
	return {
		name: "local-admin",
		apply: "serve",   // dev-server only — excluded from builds
		enforce: "pre",   // run before Astro's router so our middleware is first in chain
		async configureServer(server) {
			// Use a file:// URL so Node's native ESM loader handles the import,
			// bypassing Vite's module resolver — required for native addons like better-sqlite3.
			const { pathToFileURL } = await import("node:url");
			const { resolve } = await import("node:path");
			const handlerUrl = pathToFileURL(resolve("scripts/admin-handler.mjs")).href;
			const { handleRequest } = await import(handlerUrl);
			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith("/admin")) return next();
				console.log(`[admin-mw] ${req.method} ${req.url}`);
				handleRequest(req, res, next);
			});
			// Log once the HTTP server has bound so we know the real port
			server.httpServer?.once("listening", () => {
				const addr = server.httpServer.address();
				const port = typeof addr === "object" ? addr?.port : 4321;
				console.log(`  ➜ Admin UI:  http://localhost:${port}/admin`);
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
	integrations: [sitemap(), robotsTxt()],
	vite: {
		plugins: [localAdminPlugin()],
	},
	trailingSlash: "always",
	site: "https://astro-what-cms.netlify.app",
});
