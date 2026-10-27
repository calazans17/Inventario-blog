import type { APIRoute } from "astro";
import { articles, categories, tagEntries, url } from "../data/content.js";

export const GET: APIRoute = ({ site }) => {
  const paths = [
    "/",
    "/busca/",
    ...articles.map((article) => `/${article.slug}/`),
    ...categories.map((category) => `/categoria/${category.slug}/`),
    ...tagEntries.map((tag) => `/tag/${tag.slug}/`),
  ].map(url);
  const urls = paths.map((path) => `<url><loc>${new URL(path, site).href}</loc></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
