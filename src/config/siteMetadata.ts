/**
 * Site Metadata & JSON-LD Configuration
 *
 * Customize these values to match your site's information.
 * Site URL is configured in astro.config.mjs and used as the source of truth.
 * These are used for SEO, JSON-LD schemas, and other meta tags.
 */

export interface MenuItem {
	label: string;
	href: string;
}

export interface SiteMetadata {
	name: string;
	description: string;
	logo?: string;
	contactEmail?: string;
	searchRoute?: string;
	menu?: MenuItem[];
	showcasePageSize?: number;
}

export const siteMetadata: SiteMetadata = {
	name: "Astro Showcase — CMS Detector",
	description: "Which CMS (if any) powers each site in the Astro showcase?",
	logo: "/logo.svg",
	menu: [
		{ label: "Home", href: "/" },
		{ label: "Insights", href: "/insights" },
	],
	showcasePageSize: 50,
};
