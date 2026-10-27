import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { publishedPosts } from "./lib/supabase.js";

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
  // As postagens ficam no Supabase (tabela posts). O build lê só as publicadas.
  // No build de produção um erro aqui para o deploy (melhor do que publicar o site vazio);
  // rodando local, só avisa, para o login e o painel continuarem abrindo.
  loader: async () => {
    try {
      return (await publishedPosts()).map((post) => ({ ...post, id: post.slug }));
    } catch (error) {
      if (!import.meta.env.DEV) throw error;
      console.warn(`[supabase] ${error.message}`);
      return [];
    }
  },
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    category: z.string(),
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
  }),
});

export const collections = { posts };
