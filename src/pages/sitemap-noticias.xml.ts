import type { APIRoute } from "astro";
import { articlePath, articles, site as info } from "../data/content.js";

// Sitemap do Google Notícias: só as matérias dos últimos 2 dias (regra do Google).
// O site é refeito de hora em hora, então a lista se atualiza sozinha.
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const GET: APIRoute = ({ site }) => {
  const since = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const urls = articles
    .filter((article) => new Date(article.date).getTime() >= since)
    .map((article) => `<url><loc>${new URL(articlePath(article), site).href}</loc><news:news><news:publication><news:name>${escape(info.name)}</news:name><news:language>pt</news:language></news:publication><news:publication_date>${article.date}</news:publication_date><news:title>${escape(article.title)}</news:title></news:news></url>`)
    .join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
