// @ts-check

import sitemap from "@astrojs/sitemap";
import { defineConfig, svgoOptimizer } from "astro/config";

import robotsTxt from "astro-robots-txt";

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
	trailingSlash: "always",
	site: "http://localhost/",
});
