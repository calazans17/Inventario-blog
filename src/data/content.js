import { getCollection } from "astro:content";

// Base do site (ex.: "/inventario" no GitHub Pages, "" num domínio próprio).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const url = (path) => `${BASE}${path}`;
// Imagens enviadas pelo painel ficam como "/uploads/..."; URLs externas passam direto.
export const asset = (src) => (src?.startsWith("/") && !src.startsWith("//") ? url(src) : src);

// As categorias seguem a identidade visual e cada uma tem seu ícone em pixel,
// por isso ficam no código. A Redação (/painel) lê esta lista no build.
export const categories = [
  { slug: "beleza", name: "Beleza", icon: "beleza", description: "Maquiagem, cuidados e os produtos que viram rotina (e assunto)." },
  { slug: "musica", name: "Música", icon: "musica", description: "Discos, shows e as músicas que marcam fases inteiras da vida." },
  { slug: "games", name: "Games", icon: "games", description: "Jogos, mundos e as histórias que a gente vive com um controle na mão." },
  { slug: "pokemon", name: "Pokémon", icon: "pokemon", description: "Cartas, jogos, anime e trinta anos de pokémon na memória coletiva." },
  { slug: "achadinhos", name: "Achadinhos", icon: "achadinhos", description: "Coisas boas, baratas e úteis que a gente achou e quer te contar." },
];

// Formatos de postagem: o selo aparece nos cards e no topo da matéria.
export const formatos = [
  { value: "materia", label: "Matéria", hint: "Texto corrido, do jeito clássico." },
  { value: "review", label: "Review", hint: "Opinião com nota de 0 a 5, prós e contras." },
  { value: "lista", label: "Lista", hint: "Top 5, 10 motivos, ranking." },
  { value: "guia", label: "Guia", hint: "Passo a passo pra salvar e voltar." },
  { value: "entrevista", label: "Entrevista", hint: "Perguntas e respostas." },
  { value: "opiniao", label: "Opinião", hint: "Coluna assinada, ponto de vista." },
];
export const formatoLabel = (value) => formatos.find((formato) => formato.value === value)?.label ?? "Matéria";
export const nota = (value) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Selo do card: some na matéria comum, mostra a nota no review.
export const formatBadge = (article) => {
  if (!article.formato || article.formato === "materia") return null;
  const label = formatoLabel(article.formato);
  return article.formato === "review" && article.review ? `${label} ★ ${nota(article.review.nota)}` : label;
};

// Lugares da home que o painel deixa escolher em "Onde aparece".
export const placements = [
  { value: "principal", label: "Destaque principal (topo da home)" },
  { value: "em-alta", label: "Em alta (lista ao lado do destaque)" },
  { value: "guias", label: "Guias & achadinhos (faixa vermelha)" },
];

const wordCount = (text = "") => text.split(/\s+/).filter(Boolean).length;
// Texto dos blocos (para tempo de leitura e busca).
export const blocksText = (blocos = []) => blocos.map((bloco) => [bloco.texto, bloco.titulo, bloco.pergunta, bloco.resposta, bloco.nome, bloco.legenda, ...(bloco.itens ?? [])].filter(Boolean).join(" ")).join(" ");

// O Supabase só entrega as publicadas (ver src/lib/supabase.js).
const entries = (await getCollection("posts")).map((entry) => {
  const { data } = entry;
  return {
    slug: entry.id,
    category: data.category,
    title: data.title,
    summary: data.summary,
    image: asset(data.image),
    imageAlt: data.imageAlt,
    imageCredit: data.imageCredit,
    date: data.date.toISOString(),
    formato: data.formato,
    review: data.review,
    blocos: data.blocos,
    readingTime: Math.max(1, Math.round(wordCount(blocksText(data.blocos)) / 200)),
    featured: data.onde.includes("principal"),
    trending: data.onde.includes("em-alta"),
    guide: data.onde.includes("guias"),
    tags: data.tags,
    seo: { title: data.seoTitle || data.title, description: data.seoDescription || data.summary },
  };
});

export const articles = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

export const getCategory = (slug) => categories.find((category) => category.slug === slug);
export const categoryFor = (article) => getCategory(article.category);
export const articlePath = (article) => url(`/${article.slug}/`);
export const categoryPath = (category) => url(`/categoria/${category.slug}/`);
export const tagSlug = (tag) => tag.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const tagPath = (tag) => url(`/tag/${tagSlug(tag)}/`);
export const tagEntries = [...new Map(articles.flatMap((article) => article.tags).map((name) => [tagSlug(name), { name, slug: tagSlug(name) }])).values()];

const dateFormat = (options) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...options });
export const shortDate = (date) => dateFormat({ day: "2-digit", month: "short" }).format(new Date(date)).replace(" de ", " ").replace(".", "").toUpperCase();
export const longDate = (date) => dateFormat({ day: "2-digit", month: "long", year: "numeric" }).format(new Date(date));
export const clockTime = (date) => dateFormat({ hour: "2-digit", minute: "2-digit" }).format(new Date(date));
