import type { APIRoute } from "astro";
import { articles, categories, tagEntries, tagSlug, url } from "../data/content.js";

// Só entra no sitemap o que pode ser indexado: a busca e as tags com uma matéria só
// são noindex (busca.astro, tag/[slug].astro), e listar essas páginas gera aviso no Search Console.
const tagCount = (slug: string) => articles.filter((article) => article.tags.some((label) => tagSlug(label) === slug)).length;

export const GET: APIRoute = ({ site }) => {
  const paths = [
    "/",
    "/sobre/",
    "/contato/",
    "/privacidade/",
    ...articles.map((article) => ({ path: `/${article.slug}/`, lastmod: article.updated })),
    ...categories.map((category) => `/categoria/${category.slug}/`),
    ...tagEntries.filter((tag) => tagCount(tag.slug) >= 2).map((tag) => `/tag/${tag.slug}/`),
  ].map((entry) => (typeof entry === "string" ? { path: entry } : entry));
  // lastmod nas matérias ajuda o Google a voltar quando uma matéria é atualizada.
  const urls = paths.map(({ path, lastmod }) => `<url><loc>${new URL(url(path), site).href}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
