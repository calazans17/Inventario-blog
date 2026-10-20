import type { APIRoute } from "astro";
import { url } from "../data/content.js";

export const GET: APIRoute = ({ site }) => new Response(
  `User-agent: *\nAllow: /\nDisallow: ${url("/admin/")}\nSitemap: ${new URL(url("/sitemap.xml"), site)}`,
  { headers: { "Content-Type": "text/plain; charset=utf-8" } },
);
