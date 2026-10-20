import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";

// No GitHub Pages o workflow define SITE_URL e BASE_PATH (ex.: "/inventario").
// Num domínio próprio, deixe BASE_PATH vazio.
const site = process.env.SITE_URL || "https://somosinventario.com.br";
const base = (process.env.BASE_PATH || "").replace(/\/$/, "");

// Imagens inseridas no corpo pelo painel vêm como "/uploads/..."; prefixa a base.
const baseImages = {
  name: "base-images",
  element: {
    filter: ["img"],
    visit(node, ctx) {
      const src = node.properties?.src;
      if (typeof src === "string" && /^\/(?!\/)/.test(src)) ctx.setProperty(node, "src", `${base}${src}`);
    },
  },
};

export default defineConfig({
  site,
  base: base || "/",
  output: "static",
  trailingSlash: "always",
  markdown: { processor: satteri({ hastPlugins: [baseImages] }) },
});
