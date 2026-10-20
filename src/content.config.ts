import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Os arquivos destas pastas são criados e editados pelo painel em /admin (public/admin/config.yml).
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    author: z.string(),
    image: z.string(),
    imageAlt: z.string().default(""),
    imageCredit: z.string().optional(),
    // Onde a matéria aparece na home: "principal", "em-alta", "guias".
    onde: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    rascunho: z.boolean().default(false),
  }),
});

const autores = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/autores" }),
  schema: z.object({
    name: z.string(),
    role: z.string().default(""),
    bio: z.string().default(""),
    image: z.string().optional(),
    social: z.string().optional(),
  }),
});

export const collections = { posts, autores };
