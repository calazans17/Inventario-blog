import type { APIRoute } from "astro";
import { site, url } from "../data/content.js";

// Instalação do site como app (PWA). Os ícones ficam em public/icones/.
export const GET: APIRoute = () => new Response(JSON.stringify({
  name: site.name,
  short_name: "Inventário",
  description: "Beleza, famosos & internet, games, pokémon e achadinhos. Mais do que categorias: é o seu universo.",
  lang: "pt-BR",
  start_url: url("/"),
  scope: url("/"),
  display: "standalone",
  theme_color: "#B23B2F",
  background_color: "#FBF8F2",
  icons: [
    { src: url("/icones/icone-192.png"), sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: url("/icones/icone-512.png"), sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
}), { headers: { "Content-Type": "application/manifest+json; charset=utf-8" } });
