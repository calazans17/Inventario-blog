import type { APIRoute } from "astro";
import { categories, placements, url } from "../../data/content.js";

// Configuração do painel (Sveltia CMS). JSON é YAML válido, então geramos daqui
// para manter categorias e lugares da home iguais aos do site.
// GITHUB_REPOSITORY vem do GitHub Actions; CMS_REPO permite sobrescrever.
const repo = process.env.CMS_REPO || process.env.GITHUB_REPOSITORY || "calazans17/inventario";

export const GET: APIRoute = ({ site }) => {
  const siteUrl = new URL(url("/"), site).href;
  const config = {
    backend: { name: "github", repo, branch: "main", commit_messages: { create: "Nova postagem: {{slug}}", update: "Atualiza postagem: {{slug}}", delete: "Remove postagem: {{slug}}", uploadMedia: "Envia imagem: {{path}}", deleteMedia: "Remove imagem: {{path}}" } },
    site_url: siteUrl,
    display_url: siteUrl,
    logo_url: url("/marca/vermelho.svg"),
    media_folder: "public/uploads",
    public_folder: "/uploads",
    collections: [
      {
        name: "posts",
        label: "Postagens",
        label_singular: "Postagem",
        folder: "src/content/posts",
        extension: "md",
        format: "frontmatter",
        create: true,
        slug: "{{slug}}",
        summary: "{{title}} · {{category}}",
        sortable_fields: ["date", "title", "category"],
        preview_path: "{{slug}}/",
        fields: [
          { name: "title", label: "Título", widget: "string" },
          { name: "summary", label: "Resumo", hint: "Aparece nos cards e no topo da matéria.", widget: "text" },
          { name: "image", label: "Imagem de capa", widget: "image" },
          { name: "imageAlt", label: "Descrição da imagem", hint: "O que aparece na foto (acessibilidade e legenda).", widget: "string" },
          { name: "imageCredit", label: "Crédito da imagem", widget: "string", required: false },
          { name: "category", label: "Categoria", widget: "select", options: categories.map((c) => ({ label: c.name, value: c.slug })) },
          { name: "onde", label: "Onde aparece na home", hint: "Sem marcar nada, a postagem entra só em Últimas entradas e na página da categoria. O destaque principal mostra a mais recente marcada.", widget: "select", multiple: true, required: false, default: [], options: placements },
          { name: "author", label: "Autor", widget: "relation", collection: "autores", value_field: "{{slug}}", search_fields: ["name"], display_fields: ["name"] },
          { name: "date", label: "Data de publicação", widget: "datetime", default: "{{now}}" },
          { name: "tags", label: "Tags", widget: "list", required: false, default: [] },
          { name: "body", label: "Texto", widget: "markdown", hint: "Use o botão de imagem da barra para colocar fotos no meio do texto." },
          { name: "seoTitle", label: "Título para o Google (opcional)", widget: "string", required: false },
          { name: "seoDescription", label: "Descrição para o Google (opcional)", widget: "text", required: false },
          { name: "rascunho", label: "Rascunho (não publicar ainda)", widget: "boolean", default: false },
        ],
      },
      {
        name: "autores",
        label: "Autores",
        label_singular: "Autor",
        folder: "src/content/autores",
        extension: "json",
        format: "json",
        create: true,
        identifier_field: "name",
        slug: "{{slug}}",
        fields: [
          { name: "name", label: "Nome", widget: "string" },
          { name: "role", label: "Função", widget: "string", required: false },
          { name: "bio", label: "Bio", widget: "text", required: false },
          { name: "image", label: "Foto", widget: "image", required: false },
          { name: "social", label: "Link do Instagram", widget: "string", required: false },
        ],
      },
    ],
  };
  return new Response(JSON.stringify(config, null, 2), { headers: { "Content-Type": "application/yaml; charset=utf-8" } });
};
