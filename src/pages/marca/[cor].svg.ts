import type { APIRoute } from "astro";
import { markSvg } from "../../lib/pixel.js";

const colors = { vermelho: "#B23B2F", creme: "#FBF8F2" };

export function getStaticPaths() {
  return Object.keys(colors).map((cor) => ({ params: { cor } }));
}

export const GET: APIRoute = ({ params }) => new Response(markSvg(colors[params.cor as keyof typeof colors]), {
  headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
});
