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
	name: "Astro Showcase — What CMS? How Fast?",
	description: "CMS detection, Core Web Vitals, and Lighthouse scores for every site in the Astro showcase.",
	logo: "/logo.svg",
	menu: [
		{ label: "Home", href: "/" },
		{ label: "Version Insights", href: "/insights/" },
		{ label: "CrUX CWV", href: "/crux/" },
		{ label: "Lighthouse PSI", href: "/psi/" },
	],
	showcasePageSize: 50,
};
