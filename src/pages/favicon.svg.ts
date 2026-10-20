import type { APIRoute } from "astro";

// No tamanho de favicon os ícones viram ruído, então usamos um "I" de pixels sólido.
const I = ["#######", ".#####.", "..###..", "..###..", "..###..", ".#####.", "#######"];
const pixels = I.flatMap((row, y) => [...row].map((cell, x) => (cell === "#" ? `M${x + 2} ${y + 2}h1v1h-1z` : ""))).join("");

export const GET: APIRoute = () => new Response(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11" shape-rendering="crispEdges"><rect width="11" height="11" rx="2" fill="#B23B2F"/><path fill="#FBF8F2" d="${pixels}"/></svg>`,
  { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } },
);
