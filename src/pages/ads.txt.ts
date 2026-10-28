import type { APIRoute } from "astro";
import { site } from "../data/content.js";

// Exigido pelo AdSense. Só vale na raiz de um domínio próprio (ex.: somosinventario.com.br/ads.txt).
export const GET: APIRoute = () => new Response(
  site.adsenseClient ? `google.com, ${site.adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n` : "# Sem anúncios configurados.\n",
  { headers: { "Content-Type": "text/plain; charset=utf-8" } },
);
