// scripts/theme-cms.ts
// 2026-10-30T00:00:00Z
//
// Which CMSs a theme says it supports, matched against its catalogue text
// (title, description, body). The portal has no CMS field, so this only finds
// themes whose author names the CMS. Ambiguous words (Sanity, Ghost, Payload,
// Cosmic, Craft, Tina) need a CMS-ish suffix and are case-sensitive.

const CMS: [string, RegExp][] = [
	["Contentful", /\bContentful\b/i],
	["Sanity", /\bSanity(?:\.io| CMS| Studio)\b/],
	["Storyblok", /\bStoryblok\b/i],
	["Strapi", /\bStrapi\b/i],
	["TinaCMS", /\bTina ?CMS\b/i],
	["Decap CMS", /\b(?:Decap|Netlify) CMS\b/i],
	["Keystatic", /\bKeystatic\b/i],
	["WordPress", /\bWordPress\b/i],
	["Directus", /\bDirectus\b/i],
	["Payload CMS", /\bPayload CMS\b/i],
	["Ghost", /\bGhost (?:CMS|API|Content API)\b/],
	["Prismic", /\bPrismic\b/i],
	["DatoCMS", /\bDatoCMS\b/i],
	["Hygraph", /\bHygraph\b/i],
	["Builder.io", /\bBuilder\.io\b/i],
	["Cosmic", /\bCosmic(?: CMS|JS)\b/],
	["Craft CMS", /\bCraft CMS\b/],
	["Drupal", /\bDrupal\b/i],
	["Statamic", /\bStatamic\b/i],
	["Notion", /\bNotion\b/],
	["Kontent.ai", /\bKontent(?:\.ai)?\b/i],
	["Contentstack", /\bContentstack\b/i],
	["CloudCannon", /\bCloudCannon\b/i],
	["Pages CMS", /\bPages CMS\b/i],
	["Umbraco", /\bUmbraco\b/i],
	["Crystallize", /\bCrystallize\b/i],
	["Caisy", /\bCaisy\b/i],
	["EmDash", /\bEmDash\b/i],
	["microCMS", /\bmicroCMS\b/i],
];

/** Comma-separated CMS names found in the text, or null. */
export function themeCms(text: string): string | null {
	const found = CMS.filter(([, re]) => re.test(text)).map(([name]) => name);
	return found.length ? found.join(",") : null;
}
