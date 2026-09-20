import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Projects are a content collection rather than hardcoded markup so that
 * adding one later is a single new file, and so the schema catches a typo at
 * build time instead of rendering an empty card.
 */
const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    /** Which half of the work this proves. Drives the card's accent. */
    track: z.enum(["security", "fullstack"]),
    tagline: z.string(),
    role: z.string(),
    period: z.string(),
    stack: z.array(z.string()).min(1),
    highlights: z.array(z.string()).min(1),
    repo: z.string().url().nullable().default(null),
    /** Explains a missing repo link, e.g. an academic or private codebase. */
    repoNote: z.string().nullable().default(null),
    /** Lower sorts first. */
    order: z.number().default(99),
    featured: z.boolean().default(true),
  }),
});

export const collections = { projects };
