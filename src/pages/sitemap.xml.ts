import type { APIRoute } from "astro";
import { articles, categories, tagEntries, url } from "../data/content.js";

export const GET: APIRoute = ({ site }) => {
  const paths = [
    "/",
    "/busca/",
    "/sobre/",
    "/contato/",
    "/privacidade/",
    ...articles.map((article) => ({ path: `/${article.slug}/`, lastmod: article.updated })),
    ...categories.map((category) => `/categoria/${category.slug}/`),
    ...tagEntries.map((tag) => `/tag/${tag.slug}/`),
  ].map((entry) => (typeof entry === "string" ? { path: entry } : entry));
  // lastmod nas matérias ajuda o Google a voltar quando uma matéria é atualizada.
  const urls = paths.map(({ path, lastmod }) => `<url><loc>${new URL(url(path), site).href}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
