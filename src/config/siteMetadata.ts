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
}

export const siteMetadata: SiteMetadata = {
	// Site name - used in JSON-LD and meta tags
	name: "My Awesome Site",

	// Site description for SEO
	description: "A starter template for building amazing websites",

	// Optional: Logo URL (relative or absolute)
	logo: "/logo.svg",

	// Optional: Contact email for JSON-LD ContactPoint
	contactEmail: "info@example.com",

	// Optional: Search route for JSON-LD SearchAction
	// searchRoute: "/search",

	// Optional: Main navigation menu for JSON-LD SiteNavigationElement
	// Only include pages that actually exist on your site
	menu: [
		{ label: "Home", href: "/" },
		{ label: "About", href: "/about" },
	],
};
