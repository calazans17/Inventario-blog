import type { APIRoute } from "astro";
import { url } from "../data/content.js";

// Service worker do PWA. Páginas: busca a versão nova primeiro (notícia nova nunca fica
// presa no celular) e só usa a cópia guardada sem internet. Arquivos do build e imagens:
// usa a cópia guardada. Redação, login e chamadas ao banco passam direto, sem cache.
const version = Date.now().toString(36);

const worker = (base: string, version: string) => `
const BASE = ${JSON.stringify(base)};
const PAGES = "inventario-paginas-${version}";
const FILES = "inventario-arquivos-${version}";
const OFFLINE = BASE + "/offline/";
const SKIP = ["/painel/", "/entrar/", "/admin/"].map((path) => BASE + path);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.addAll([OFFLINE, BASE + "/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("inventario-") && ![PAGES, FILES].includes(key)).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

// Guarda no máximo "max" respostas em cada cache (as mais antigas saem primeiro).
async function put(name, request, response, max) {
  const cache = await caches.open(name);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function page(request) {
  try {
    const response = await fetch(request);
    if (response.ok) put(PAGES, request, response.clone(), 40);
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) ?? (await caches.match(OFFLINE));
  }
}

async function file(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") put(FILES, request, response.clone(), 120);
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const target = new URL(request.url);
  const local = target.origin === self.location.origin;
  if (local && SKIP.some((path) => target.pathname.startsWith(path))) return;
  if (request.mode === "navigate" && local) return event.respondWith(page(request));
  const built = local && target.pathname.startsWith(BASE + "/_astro/");
  const images = request.destination === "image" && (local || target.pathname.startsWith("/storage/v1/object/public/"));
  const fonts = ["fonts.googleapis.com", "fonts.gstatic.com"].includes(target.hostname);
  if (built || images || fonts) event.respondWith(file(request));
});
`;

export const GET: APIRoute = () => new Response(worker(url("").replace(/\/$/, ""), version), {
  headers: { "Content-Type": "text/javascript; charset=utf-8" },
});
