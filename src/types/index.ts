// types/index.ts

/**
 * Metadata for page SEO and social sharing
 * Used by BaseLayout and Basehead components
 */
export interface MetaData {
	/** Page title - appears in browser tab and search results */
	title: string;
	/** Page description - used for SEO and social media previews */
	description: string;
	/** Open Graph image filename (stored in /public/images/social/) */
	imageOG?: string;
	/** Alt text for Open Graph image */
	altOG?: string;
}
