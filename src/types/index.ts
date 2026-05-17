// types/index.ts

export interface CmsResult {
	title: string;
	url: string;
	cms: string;
	cmsType: string;
	confidence: string | null;
	evidence: string[];
	categories: string[];
	astroDetected: boolean;
	astroVersion: string | null;
	astroSignals: string[];
	finalUrl: string | null;
	dateAdded: string;
	fetchedAt: string;
	error?: string;
}

export interface ResultsFile {
	generated: string;
	sourceDir: string;
	total: number;
	results: CmsResult[];
}

export const CMS_TYPE_LABELS: Record<string, string> = {
	"headless-cms": "Headless CMS",
	"page-builder": "Page Builder",
	"full-site": "Full-site (no Astro)",
	framework: "JS Framework",
	"static-gen": "Static Gen",
	parked: "Parked / Forwarded",
};

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
