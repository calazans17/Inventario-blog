// Conexão com o Supabase (banco, login e imagens). A chave publicável é pública por
// natureza: quem protege os dados são as regras do banco (supabase/schema.sql).
// PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_PUBLISHABLE_KEY permitem apontar para outro projeto.
export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "https://xvrnwnquacaiuitsanps.supabase.co";
export const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_6qYPx7edTZTUpAjYVDpdug_LYrcV_U4";
export const BUCKET = "imagens";

// Colunas do banco (snake_case) ↔ campos da postagem usados no site e no painel.
const renamed = { image_alt: "imageAlt", image_credit: "imageCredit", seo_title: "seoTitle", seo_description: "seoDescription" };

export function fromRow(row) {
  const post = {};
  for (const [column, value] of Object.entries(row)) if (value !== null) post[renamed[column] ?? column] = value;
  return post;
}

export function toRow(post) {
  const columns = Object.fromEntries(Object.entries(renamed).map(([column, field]) => [field, column]));
  return Object.fromEntries(Object.entries(post).map(([field, value]) => [columns[field] ?? field, value ?? null]));
}

// Postagens publicadas, lidas no build do site.
export async function publishedPosts() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=*&rascunho=eq.false&order=date.desc`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const hint = data.code === "PGRST205" ? " Rode supabase/schema.sql no SQL Editor do Supabase." : "";
    throw new Error(`Não deu pra ler as postagens no Supabase: ${data.message || response.statusText}.${hint}`);
  }
  return (await response.json()).map(fromRow);
}
