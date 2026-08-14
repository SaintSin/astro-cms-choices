// src/content.config.ts

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const notes = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/notes" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		ogImage: z.string().optional(),
	}),
});

export const collections = { notes };
