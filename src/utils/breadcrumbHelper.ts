/**
 * De-slugify a URL segment to Title Case
 * e.g. "getting-started" → "Getting Started"
 */
function deslugify(slug: string): string {
	return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

interface BreadcrumbItem {
	"@type": "ListItem";
	position: number;
	name: string;
	item?: string;
}

/**
 * Generate a BreadcrumbList JSON-LD object from a URL pathname.
 *
 * @param pathname - The current page pathname (e.g. "/docs/getting-started/")
 * @param baseUrl - The site base URL (e.g. "https://example.com")
 * @param pageTitle - Optional human-readable title for the last breadcrumb item
 */
export function generateBreadcrumbJsonLd(
	pathname: string,
	baseUrl: string,
	pageTitle?: string,
) {
	const segments = pathname.split("/").filter(Boolean);

	const items: BreadcrumbItem[] = [];

	if (segments.length === 0) {
		// Home page — single item, no item URL (it's the current page)
		items.push({
			"@type": "ListItem",
			position: 1,
			name: "Home",
		});
	} else {
		// First item is always Home with a link
		items.push({
			"@type": "ListItem",
			position: 1,
			name: "Home",
			item: `${baseUrl}/`,
		});

		// Intermediate segments
		let path = "";
		for (let i = 0; i < segments.length; i++) {
			path += `/${segments[i]}`;
			const isLast = i === segments.length - 1;
			const name = isLast && pageTitle ? pageTitle : deslugify(segments[i]);

			const breadcrumb: BreadcrumbItem = {
				"@type": "ListItem",
				position: i + 2,
				name,
			};

			// Last item has no item URL (it's the current page)
			if (!isLast) {
				breadcrumb.item = `${baseUrl}${path}/`;
			}

			items.push(breadcrumb);
		}
	}

	return {
		"@type": "BreadcrumbList",
		itemListElement: items,
	};
}
