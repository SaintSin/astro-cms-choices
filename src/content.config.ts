// src/content.config.ts

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const notes = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/notes" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// `date` is the original publication date; `updated` is the last
		// substantive revision (omit until the note is actually revised).
		date: z.coerce.date(),
		updated: z.coerce.date().optional(),
		ogImage: z.string().optional(),
	}),
});

export const collections = { notes };
