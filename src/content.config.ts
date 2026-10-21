import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Os arquivos destas pastas são criados e editados pela Redação em /painel.
const image = z.object({ src: z.string(), alt: z.string().default(""), legenda: z.string().optional() });

// Blocos do corpo da matéria, montados no editor de /painel.
const bloco = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("texto"), texto: z.string() }),
  z.object({ tipo: z.literal("subtitulo"), texto: z.string() }),
  z.object({ tipo: z.literal("imagem"), src: z.string(), alt: z.string().default(""), legenda: z.string().optional(), largura: z.enum(["normal", "larga"]).default("normal") }),
  z.object({ tipo: z.literal("galeria"), imagens: z.array(image).default([]) }),
  z.object({ tipo: z.literal("trecho"), texto: z.string(), fonte: z.string().optional() }),
  z.object({ tipo: z.literal("dica"), titulo: z.string().optional(), texto: z.string() }),
  z.object({ tipo: z.literal("lista"), itens: z.array(z.string()).default([]), numerada: z.boolean().default(false) }),
  z.object({ tipo: z.literal("produto"), nome: z.string(), preco: z.string().optional(), link: z.string().optional(), loja: z.string().optional(), imagem: z.string().optional(), nota: z.string().optional() }),
  z.object({ tipo: z.literal("video"), url: z.string(), legenda: z.string().optional() }),
  z.object({ tipo: z.literal("pergunta"), pergunta: z.string(), resposta: z.string() }),
  z.object({ tipo: z.literal("divisor") }),
]);

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    author: z.string(),
    // Formato da postagem: muda o selo nos cards e alguns detalhes da página.
    formato: z.enum(["materia", "review", "lista", "guia", "entrevista", "opiniao"]).default("materia"),
    image: z.string(),
    imageAlt: z.string().default(""),
    imageCredit: z.string().optional(),
    // Onde a matéria aparece na home: "principal", "em-alta", "guias".
    onde: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    blocos: z.array(bloco).default([]),
    // Só para o formato review.
    review: z.object({ nota: z.number().min(0).max(5), veredito: z.string().optional(), pros: z.array(z.string()).default([]), contras: z.array(z.string()).default([]) }).optional(),
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
