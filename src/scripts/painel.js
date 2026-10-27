// Redação do Somos Inventário: lista de postagens e editor em blocos.
// Tudo roda no navegador e salva no Supabase (tabela posts e bucket de imagens).
import { pages, supabase } from "./auth.js";
import { BUCKET, fromRow, toRow } from "../lib/supabase.js";
import { escapeHtml as h, inline, paragraphs, youtubeId } from "../lib/inline.js";

const { base } = document.body.dataset;
const config = JSON.parse(document.querySelector("#panel-config").textContent);
let user = null;
const view = document.querySelector("#view");
const RESERVED = ["busca", "categoria", "tag", "entrar", "cadastro", "painel", "admin", "marca", "uploads", "404", "sitemap", "robots"];

let posts = [];
// Visualizações por postagem (supabase/visualizacoes.sql): slug → { total, ultimos_7, hoje }.
let views = new Map();
let draft = null;
let dirty = false;
let showPreview = false;
// Imagens escolhidas nesta sessão: caminho provisório → arquivo (até salvar) e → URL local (para mostrar).
const pending = new Map();
const previews = new Map();

/* ---------- utilidades ---------- */

const slugify = (text = "") => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
const imgUrl = (src) => (!src ? "" : previews.get(src) ?? (src.startsWith("/") && !src.startsWith("//") ? `${base}${src}` : src));
const category = (slug) => config.categories.find((item) => item.slug === slug);
const formatoLabel = (value) => config.formatos.find((item) => item.value === value)?.label ?? "Matéria";
const firstName = (name = "") => name.split(" ")[0];
const toLocalInput = (iso) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const dateLabel = (iso) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const nota = (value) => Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const count = (value = 0) => Number(value).toLocaleString("pt-BR");
const viewsOf = (slug) => views.get(slug) ?? { total: 0, ultimos_7: 0, hoje: 0 };
const words = (text = "") => text.split(/\s+/).filter(Boolean).length;
const debounce = (fn, wait) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

function toast(message, tone = "ok") {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (element.hidden = true), 4200);
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}
function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((value, key) => (value[key] ??= {}), object);
  target[last] = value;
}

/* ---------- blocos ---------- */

const BLOCKS = {
  texto: { label: "Texto", icon: "¶", hint: "Parágrafos. **negrito**, _itálico_ e [link](https://...)", make: () => ({ tipo: "texto", texto: "" }) },
  subtitulo: { label: "Subtítulo", icon: "H", hint: "Divide a matéria em partes.", make: () => ({ tipo: "subtitulo", texto: "" }) },
  imagem: { label: "Imagem", icon: "▣", hint: "Foto no meio do texto, com legenda.", make: () => ({ tipo: "imagem", src: "", alt: "", legenda: "", largura: "normal" }) },
  galeria: { label: "Galeria", icon: "▦", hint: "Várias fotos lado a lado.", make: () => ({ tipo: "galeria", imagens: [] }) },
  trecho: { label: "Trecho em destaque", icon: "“", hint: "Aquela frase que merece ser grifada.", make: () => ({ tipo: "trecho", texto: "", fonte: "" }) },
  dica: { label: "Caixa de dica", icon: "!", hint: "\"Anota aí\": um recado à parte.", make: () => ({ tipo: "dica", titulo: "Anota aí", texto: "" }) },
  lista: { label: "Lista", icon: "≡", hint: "Tópicos ou ranking numerado.", make: () => ({ tipo: "lista", itens: [], numerada: false }) },
  produto: { label: "Achadinho", icon: "$", hint: "Produto com foto, preço e link.", make: () => ({ tipo: "produto", nome: "", preco: "", loja: "", link: "", imagem: "", nota: "" }) },
  video: { label: "Vídeo", icon: "▶", hint: "Link do YouTube.", make: () => ({ tipo: "video", url: "", legenda: "" }) },
  pergunta: { label: "Pergunta & resposta", icon: "?", hint: "Para entrevistas e FAQ.", make: () => ({ tipo: "pergunta", pergunta: "", resposta: "" }) },
  divisor: { label: "Divisor", icon: "···", hint: "Uma pausa entre partes.", make: () => ({ tipo: "divisor" }) },
};

// Ponto de partida de cada formato (só em postagem nova e vazia).
const TEMPLATES = {
  materia: () => [BLOCKS.texto.make()],
  review: () => [BLOCKS.texto.make(), BLOCKS.imagem.make(), BLOCKS.subtitulo.make(), BLOCKS.texto.make(), BLOCKS.trecho.make()],
  lista: () => [BLOCKS.texto.make(), ...[1, 2, 3].flatMap(() => [{ ...BLOCKS.subtitulo.make() }, BLOCKS.imagem.make(), BLOCKS.texto.make()])],
  guia: () => [BLOCKS.texto.make(), { ...BLOCKS.lista.make(), numerada: true }, BLOCKS.dica.make()],
  entrevista: () => [BLOCKS.texto.make(), BLOCKS.pergunta.make(), BLOCKS.pergunta.make(), BLOCKS.trecho.make(), BLOCKS.pergunta.make()],
  opiniao: () => [BLOCKS.trecho.make(), BLOCKS.texto.make()],
};

const blockIsEmpty = (bloco) => {
  switch (bloco.tipo) {
    case "texto": case "subtitulo": case "trecho": case "dica": return !bloco.texto?.trim();
    case "imagem": return !bloco.src;
    case "galeria": return !bloco.imagens?.length;
    case "lista": return !bloco.itens?.length;
    case "produto": return !bloco.nome?.trim();
    case "video": return !bloco.url?.trim();
    case "pergunta": return !bloco.pergunta?.trim();
    default: return false;
  }
};

// Tira campos vazios e blocos sem conteúdo antes de gravar.
function cleanBlock(bloco) {
  const clean = Object.fromEntries(Object.entries(bloco).filter(([, value]) => value !== "" && value !== undefined));
  if (clean.imagens) clean.imagens = clean.imagens.map((imagem) => Object.fromEntries(Object.entries(imagem).filter(([, value]) => value !== "")));
  return clean;
}

/* ---------- carregamento ---------- */

const sortPosts = (list) => list.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

async function loadAll() {
  const { data, error } = await supabase.from("posts").select("*");
  if (error) throw error;
  posts = sortPosts(data.map((row) => ({ slug: row.slug, data: fromRow(row) })));
  // Sem o SQL das visualizações rodado, o painel abre do mesmo jeito, só sem os números.
  const summary = await supabase.rpc("resumo_visualizacoes");
  if (summary.error) console.warn("Visualizações indisponíveis:", summary.error.message);
  views = new Map((summary.data ?? []).map((row) => [row.post_slug, row]));
}

/* ---------- imagens no Supabase ---------- */

// Caminho dentro do bucket a partir da URL pública (só das imagens que são nossas).
const storagePrefix = supabase.storage.from(BUCKET).getPublicUrl("").data.publicUrl;
const storagePath = (src) => (typeof src === "string" && src.startsWith(storagePrefix) ? decodeURIComponent(src.slice(storagePrefix.length)) : null);
const imagesOf = (data) => [...new Set((JSON.stringify(data).match(/"(https?:[^"]+)"/g) ?? []).map((match) => storagePath(JSON.parse(match))).filter(Boolean))];

async function removeImages(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn("Não deu pra apagar imagens antigas:", error.message);
}

/* ---------- cabeçalho ---------- */

const userName = () => user?.user_metadata?.nome || user?.email?.split("@")[0] || "";

function renderUser() {
  document.querySelector("#panel-user").innerHTML = `
    <details class="user-menu">
      <summary><span class="user-initial" aria-hidden="true">${h(userName().charAt(0).toUpperCase())}</span><span>${h(firstName(userName()))}</span></summary>
      <div class="user-menu-list">
        <span class="user-menu-email">${h(user.email)}</span>
        <a href="${base}/" target="_blank" rel="noreferrer">Ver o site ↗</a>
        <button type="button" data-action="logout">Sair</button>
      </div>
    </details>`;
}

function setNav(active) {
  for (const link of document.querySelectorAll("[data-nav]")) link.classList.toggle("is-active", link.dataset.nav === active);
}

/* ---------- publicação ---------- */

// O site é estático: depois de salvar, o GitHub Actions refaz as páginas (ver .github/workflows/deploy.yml).
const SITE_DELAY = "O site atualiza em alguns minutos.";

/* ---------- lista ---------- */

let listFilter = "todas";
let listQuery = "";

function renderList() {
  setNav("lista");
  const published = posts.filter((post) => !post.data.rascunho);
  const drafts = posts.filter((post) => post.data.rascunho);
  const normalized = slugify(listQuery).replace(/-/g, " ");
  const weekViews = [...views.values()].reduce((total, item) => total + Number(item.ultimos_7), 0);
  const visible = posts.filter((post) => {
    if (listFilter === "publicadas" && post.data.rascunho) return false;
    if (listFilter === "rascunhos" && !post.data.rascunho) return false;
    if (listFilter === "mais-vistas" && post.data.rascunho) return false;
    return !normalized || slugify(`${post.data.title} ${post.data.summary} ${(post.data.tags ?? []).join(" ")}`).replace(/-/g, " ").includes(normalized);
  });
  if (listFilter === "mais-vistas") visible.sort((a, b) => viewsOf(b.slug).total - viewsOf(a.slug).total);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  view.innerHTML = `
    <section class="dash-hero">
      <div>
        <span class="eyebrow">${greeting}, ${h(firstName(userName()))}</span>
        <h1>O que vai pro <em>inventário</em> hoje?</h1>
      </div>
      <a class="primary-button" href="#/nova"><span>Nova postagem</span><span aria-hidden="true">+</span></a>
    </section>
    <section class="dash-stats" aria-label="Resumo">
      <div><strong>${published.length}</strong><span>no ar</span></div>
      <div><strong>${drafts.length}</strong><span>rascunhos</span></div>
      <div title="Visitas nas matérias nos últimos 7 dias"><strong>${count(weekViews)}</strong><span>visualizações · 7 dias</span></div>
      <div class="dash-cats">${config.categories.map((item) => `<span title="${h(item.name)}">${item.icon}<b>${posts.filter((post) => post.data.category === item.slug).length}</b></span>`).join("")}</div>
    </section>
    <section class="dash-list">
      <div class="dash-toolbar">
        <div class="segmented" role="tablist">
          ${[["todas", "Todas"], ["publicadas", "No ar"], ["rascunhos", "Rascunhos"], ["mais-vistas", "Mais vistas"]].map(([value, label]) => `<button type="button" role="tab" aria-selected="${listFilter === value}" data-action="filter" data-value="${value}">${label}</button>`).join("")}
        </div>
        <label class="dash-search"><span class="search-icon" aria-hidden="true"></span><input type="search" id="list-search" placeholder="Buscar postagem" value="${h(listQuery)}" /></label>
      </div>
      ${visible.length ? `<ul class="post-rows">${visible.map(postRow).join("")}</ul>` : emptyList()}
    </section>`;
  const search = document.querySelector("#list-search");
  search.addEventListener("input", debounce(() => {
    listQuery = search.value;
    renderList();
    const again = document.querySelector("#list-search");
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  }, 200));
}

function postRow(post) {
  const { data } = post;
  const cat = category(data.category);
  return `
    <li class="post-row">
      <a class="post-row-main" href="#/editar/${h(post.slug)}">
        <span class="post-thumb">${data.image ? `<img src="${h(imgUrl(data.image))}" alt="" loading="lazy" />` : ""}</span>
        <span class="post-row-copy">
          <span class="post-row-meta">${cat ? `<span class="category-label">${cat.icon}${h(cat.name)}</span>` : ""}<span class="chip">${h(formatoLabel(data.formato))}${data.formato === "review" && data.review ? ` ★ ${nota(data.review.nota)}` : ""}</span>${data.rascunho ? `<span class="chip chip--draft">Rascunho</span>` : `<span class="chip chip--live">No ar</span>`}</span>
          <strong>${h(data.title || "Sem título")}</strong>
          <small>${data.date ? dateLabel(data.date) : ""}${data.rascunho ? "" : ` · ${viewsLabel(post.slug)}`}</small>
        </span>
      </a>
      <div class="post-row-actions">
        ${data.rascunho ? "" : `<a class="icon-button" href="${base}/${h(post.slug)}/" target="_blank" rel="noreferrer" title="Ver no site">↗</a>`}
        <button type="button" class="icon-button icon-button--danger" data-action="delete-post" data-slug="${h(post.slug)}" title="Excluir">✕</button>
      </div>
    </li>`;
}

function viewsLabel(slug) {
  const { total, ultimos_7: week } = viewsOf(slug);
  return `${count(total)} ${Number(total) === 1 ? "visualização" : "visualizações"}${Number(week) ? ` (${count(week)} nos últimos 7 dias)` : ""}`;
}

const emptyList = () => posts.length
  ? `<p class="empty-state">Nada encontrado com esse filtro.</p>`
  : `<div class="dash-empty"><img src="${config.mark}" alt="" width="60" height="80" /><h2>O inventário está <em>em branco</em>.</h2><p>A primeira postagem é a que inaugura a casa. Bora?</p><a class="primary-button" href="#/nova"><span>Escrever a primeira</span><span aria-hidden="true">→</span></a></div>`;

async function deletePost(slug) {
  const post = posts.find((item) => item.slug === slug);
  if (!post || !window.confirm(`Excluir "${post.data.title}"? Ela sai do site junto com as imagens dela.`)) return;
  try {
    const { error } = await supabase.from("posts").delete().eq("slug", slug);
    if (error) throw error;
    await removeImages(imagesOf(post.data));
    posts = posts.filter((item) => item !== post);
    toast(`Postagem excluída. ${SITE_DELAY}`);
    renderList();
  } catch (error) {
    toast(`Não deu pra excluir: ${error.message}`, "error");
  }
}

/* ---------- editor ---------- */

const draftKey = () => `inventario:rascunho:${draft?.slug ?? "novo"}`;

function newDraft() {
  return {
    slug: null,
    slugInput: "",
    title: "",
    summary: "",
    formato: "materia",
    category: "",
    date: new Date().toISOString(),
    image: "",
    imageAlt: "",
    imageCredit: "",
    onde: [],
    tags: [],
    blocos: TEMPLATES.materia(),
    review: { nota: 4, veredito: "", pros: [], contras: [] },
    seoTitle: "",
    seoDescription: "",
    rascunho: false,
  };
}

function draftFromPost(post) {
  const { data } = post;
  return {
    ...newDraft(),
    ...data,
    slug: post.slug,
    existing: true,
    onde: data.onde ?? [],
    tags: data.tags ?? [],
    blocos: data.blocos ?? [],
    review: { nota: 4, veredito: "", pros: [], contras: [], ...(data.review ?? {}) },
  };
}

function openEditor(slug) {
  showPreview = false;
  if (slug) {
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      toast("Essa postagem não existe mais.", "error");
      location.hash = "#/";
      return;
    }
    draft = draftFromPost(post);
  } else {
    draft = newDraft();
  }
  dirty = false;
  setNav(slug ? "" : "nova");
  renderEditor();
  offerLocalCopy();
}

function offerLocalCopy() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(draftKey()) ?? "null"); } catch { saved = null; }
  if (!saved?.draft) return;
  const banner = document.querySelector("#restore");
  banner.hidden = false;
  banner.querySelector("span").textContent = `Tem uma versão não salva de ${dateLabel(saved.at)}.`;
}

const autosave = debounce(() => {
  if (!draft || !dirty) return;
  try { localStorage.setItem(draftKey(), JSON.stringify({ at: new Date().toISOString(), draft })); } catch { /* sem espaço */ }
}, 800);

function markDirty() {
  dirty = true;
  autosave();
  refreshLive();
}

function renderEditor() {
  const isReview = draft.formato === "review";
  const slugPreview = draft.slug ?? uniqueSlug(slugify(draft.title) || "nova-postagem");
  view.innerHTML = `
    <div class="editor-bar">
      <a class="section-link" href="#/" data-action="back"><span aria-hidden="true">←</span> Postagens</a>
      <span class="editor-state" id="editor-state">${draft.existing ? (draft.rascunho ? "Rascunho" : "No ar") : "Nova postagem"}</span>
      <div class="editor-bar-actions">
        <button type="button" class="ghost-button" data-action="toggle-preview" aria-pressed="${showPreview}">${showPreview ? "Voltar a escrever" : "Pré-visualizar"}</button>
        <button type="button" class="ghost-button" data-action="save-draft">Salvar rascunho</button>
        <button type="button" class="primary-button" data-action="publish"><span>${draft.existing && !draft.rascunho ? "Atualizar" : "Publicar"}</span><span aria-hidden="true">↑</span></button>
      </div>
    </div>
    <div class="restore-banner" id="restore" hidden><span></span><button type="button" class="ghost-button" data-action="restore">Recuperar</button><button type="button" class="link-button" data-action="discard-local">Descartar</button></div>
    <ul class="form-errors" id="form-errors" hidden></ul>

    <div class="editor-grid" ${showPreview ? "hidden" : ""}>
      <div class="editor-main">
        <section class="format-picker" aria-label="Formato">
          ${config.formatos.map((item) => `<button type="button" class="format-option" data-action="formato" data-value="${item.value}" aria-pressed="${draft.formato === item.value}"><strong>${h(item.label)}</strong><small>${h(item.hint)}</small></button>`).join("")}
        </section>

        <textarea class="title-input" data-path="title" rows="1" placeholder="Um título que dá vontade de clicar">${h(draft.title)}</textarea>
        <label class="field">
          <span class="field-label">Trecho de chamada <small class="counter" data-counter="summary">${draft.summary.length}/180</small></span>
          <textarea data-path="summary" rows="2" placeholder="A frase que aparece nos cards e abre a matéria.">${h(draft.summary)}</textarea>
        </label>

        <section class="cover-field">
          <span class="field-label">Imagem de capa</span>
          ${imageDrop("image", draft.image, "cover")}
          <div class="field-row">
            <label class="field"><span class="field-label">O que aparece na foto</span><input data-path="imageAlt" value="${h(draft.imageAlt)}" placeholder="Ex.: pelúcia gigante do Pikachu numa vitrine" /></label>
            <label class="field"><span class="field-label">Crédito</span><input data-path="imageCredit" value="${h(draft.imageCredit ?? "")}" placeholder="Foto: Fulana / Divulgação" /></label>
          </div>
        </section>

        ${isReview ? reviewFields() : ""}

        <section class="blocks" aria-label="Corpo da matéria">
          <div class="blocks-heading"><span class="field-label">Corpo da matéria</span><small id="word-count"></small></div>
          ${draft.blocos.map((bloco, index) => inserter(index) + blockCard(bloco, index)).join("")}
          <div class="block-palette">
            <span class="field-label">Adicionar bloco</span>
            <div class="block-palette-grid">${Object.entries(BLOCKS).map(([type, item]) => `<button type="button" data-action="add-block" data-type="${type}" data-at="${draft.blocos.length}"><span class="block-icon">${item.icon}</span><span><strong>${item.label}</strong><small>${h(item.hint)}</small></span></button>`).join("")}</div>
          </div>
        </section>
      </div>

      <aside class="editor-side">
        ${draft.existing && !draft.rascunho ? viewsCard() : ""}
        <section class="side-card">
          <span class="field-label">Categoria</span>
          <div class="cat-picker">${config.categories.map((item) => `<button type="button" data-action="category" data-value="${item.slug}" aria-pressed="${draft.category === item.slug}">${item.icon}${h(item.name)}</button>`).join("")}</div>
        </section>
        <section class="side-card">
          <label class="field"><span class="field-label">Data de publicação</span><input type="datetime-local" data-path="date" data-kind="date" value="${toLocalInput(draft.date)}" /></label>
          <label class="field"><span class="field-label">Endereço</span>
            ${draft.existing ? `<code class="slug-preview">/${h(draft.slug)}/</code>` : `<span class="slug-input"><span>/</span><input data-path="slugInput" data-kind="slug" value="${h(draft.slugInput)}" placeholder="${h(slugPreview)}" /><span>/</span></span>`}
          </label>
        </section>
        <section class="side-card">
          <span class="field-label">Onde aparece na home</span>
          ${config.placements.map((item) => `<label class="check"><input type="checkbox" data-action="onde" value="${item.value}" ${draft.onde.includes(item.value) ? "checked" : ""} /><span>${h(item.label)}</span></label>`).join("")}
          <small class="field-hint">Sem marcar nada, entra em Últimas entradas e na categoria.</small>
        </section>
        <section class="side-card">
          <label class="field"><span class="field-label">Tags</span><input data-path="tags" data-kind="tags" value="${h(draft.tags.join(", "))}" placeholder="nostalgia, pikachu, game boy" /></label>
          <div class="tag-chips" id="tag-chips">${tagChips()}</div>
        </section>
        <section class="side-card">
          <span class="field-label">Assim fica o card</span>
          <div class="card-preview" id="card-preview">${cardPreview()}</div>
        </section>
        <details class="side-card seo-card">
          <summary class="field-label">Google (opcional)</summary>
          <label class="field"><span class="field-label">Título <small class="counter" data-counter="seoTitle"></small></span><input data-path="seoTitle" value="${h(draft.seoTitle ?? "")}" placeholder="Usa o título da matéria" /></label>
          <label class="field"><span class="field-label">Descrição <small class="counter" data-counter="seoDescription"></small></span><textarea data-path="seoDescription" rows="3" placeholder="Usa o trecho de chamada">${h(draft.seoDescription ?? "")}</textarea></label>
          <div class="serp" id="serp">${serpPreview()}</div>
        </details>
        ${draft.existing ? `<button type="button" class="link-button link-button--danger" data-action="delete-current">Excluir esta postagem</button>` : ""}
      </aside>
    </div>

    <div class="preview-pane" ${showPreview ? "" : "hidden"}>${showPreview ? articlePreview() : ""}</div>
    <input type="file" id="file-input" accept="image/*" hidden />`;
  autosize();
  refreshLive();
}

function viewsCard() {
  const { total, ultimos_7: week, hoje } = viewsOf(draft.slug);
  return `
    <section class="side-card views-card" aria-label="Visualizações">
      <span class="field-label">Visualizações</span>
      <div class="views-grid"><div><strong>${count(total)}</strong><small>no total</small></div><div><strong>${count(week)}</strong><small>7 dias</small></div><div><strong>${count(hoje)}</strong><small>hoje</small></div></div>
      <small class="field-hint">Só a equipe vê. Conta uma visita por pessoa por dia.</small>
    </section>`;
}

function inserter(index) {
  return `<div class="inserter"><button type="button" data-action="open-inserter" data-at="${index}" aria-label="Inserir bloco aqui">+</button><div class="inserter-menu" hidden>${Object.entries(BLOCKS).map(([type, item]) => `<button type="button" data-action="add-block" data-type="${type}" data-at="${index}"><span class="block-icon">${item.icon}</span>${item.label}</button>`).join("")}</div></div>`;
}

function imageDrop(path, src, variant = "") {
  return `
    <div class="image-drop ${variant ? `image-drop--${variant}` : ""} ${src ? "has-image" : ""}" data-drop="${path}">
      ${src ? `<img src="${h(imgUrl(src))}" alt="" /><div class="image-drop-actions"><button type="button" class="ghost-button" data-action="pick-image" data-path="${path}">Trocar</button><button type="button" class="ghost-button" data-action="clear-image" data-path="${path}">Remover</button></div>`
        : `<button type="button" class="image-drop-empty" data-action="pick-image" data-path="${path}"><span class="block-icon">▣</span><strong>Escolher imagem</strong><small>ou arraste aqui · JPG, PNG, WebP, GIF</small></button>`}
    </div>`;
}

function field(path, label, value = "", placeholder = "", { multiline = false, rows = 3, kind = "" } = {}) {
  const attrs = `data-path="${path}" ${kind ? `data-kind="${kind}"` : ""} placeholder="${h(placeholder)}"`;
  return `<label class="field"><span class="field-label">${label}</span>${multiline ? `<textarea ${attrs} rows="${rows}">${h(value)}</textarea>` : `<input ${attrs} value="${h(value)}" />`}</label>`;
}

function blockCard(bloco, index) {
  const item = BLOCKS[bloco.tipo];
  const p = (name) => `blocos.${index}.${name}`;
  let body = "";
  switch (bloco.tipo) {
    case "texto":
      body = `<textarea class="prose-input" data-path="${p("texto")}" rows="4" placeholder="Escreva aqui. Linha em branco separa parágrafos.">${h(bloco.texto)}</textarea>`;
      break;
    case "subtitulo":
      body = `<input class="subtitle-input" data-path="${p("texto")}" value="${h(bloco.texto)}" placeholder="Subtítulo" />`;
      break;
    case "imagem":
      body = `${imageDrop(p("src"), bloco.src)}
        <div class="field-row">${field(p("alt"), "O que aparece na foto", bloco.alt, "Descrição para acessibilidade")}${field(p("legenda"), "Legenda", bloco.legenda, "Opcional")}</div>
        <label class="check"><input type="checkbox" data-path="${p("largura")}" data-kind="wide" ${bloco.largura === "larga" ? "checked" : ""} /><span>Imagem larga (passa da coluna de texto)</span></label>`;
      break;
    case "galeria":
      body = `<div class="gallery-edit">${bloco.imagens.map((imagem, at) => `
          <div class="gallery-item"><img src="${h(imgUrl(imagem.src))}" alt="" /><button type="button" class="icon-button icon-button--danger" data-action="gallery-remove" data-index="${index}" data-at="${at}" title="Tirar da galeria">✕</button>
          <input data-path="${p(`imagens.${at}.alt`)}" value="${h(imagem.alt ?? "")}" placeholder="Descrição" /><input data-path="${p(`imagens.${at}.legenda`)}" value="${h(imagem.legenda ?? "")}" placeholder="Legenda" /></div>`).join("")}
        <button type="button" class="gallery-add" data-action="gallery-add" data-index="${index}"><span class="block-icon">+</span>Adicionar fotos</button></div>`;
      break;
    case "trecho":
      body = `<textarea class="quote-input" data-path="${p("texto")}" rows="2" placeholder="“A frase que merece ser grifada.”">${h(bloco.texto)}</textarea>${field(p("fonte"), "Quem disse (opcional)", bloco.fonte, "Ex.: Satoshi Tajiri, criador de Pokémon")}`;
      break;
    case "dica":
      body = `${field(p("titulo"), "Título da caixa", bloco.titulo, "Anota aí")}${field(p("texto"), "Texto", bloco.texto, "O recado à parte", { multiline: true })}`;
      break;
    case "lista":
      body = `${field(p("itens"), "Um item por linha", (bloco.itens ?? []).join("\n"), "Primeiro item\nSegundo item", { multiline: true, rows: 4, kind: "lines" })}
        <label class="check"><input type="checkbox" data-path="${p("numerada")}" data-kind="bool" ${bloco.numerada ? "checked" : ""} /><span>Ranking numerado (01, 02, 03…)</span></label>`;
      break;
    case "produto":
      body = `<div class="product-edit">${imageDrop(p("imagem"), bloco.imagem, "square")}<div>
        ${field(p("nome"), "Produto", bloco.nome, "Ex.: Garrafa térmica 500 ml")}
        <div class="field-row">${field(p("preco"), "Preço", bloco.preco, "R$ 49,90")}${field(p("loja"), "Loja", bloco.loja, "Ex.: Amazon")}</div>
        ${field(p("link"), "Link", bloco.link, "https://")}
        ${field(p("nota"), "Por que vale", bloco.nota, "Uma frase rápida", { multiline: true, rows: 2 })}</div></div>`;
      break;
    case "video":
      body = `${field(p("url"), "Link do YouTube", bloco.url, "https://www.youtube.com/watch?v=...")}${field(p("legenda"), "Legenda", bloco.legenda, "Opcional")}`;
      break;
    case "pergunta":
      body = `${field(p("pergunta"), "Pergunta", bloco.pergunta, "O que você perguntou?")}${field(p("resposta"), "Resposta", bloco.resposta, "O que ouviu de volta", { multiline: true, rows: 4 })}`;
      break;
    case "divisor":
      body = `<div class="block-divider" aria-hidden="true"><span></span><span></span><span></span></div>`;
      break;
  }
  return `
    <article class="block-card" data-type="${bloco.tipo}">
      <header class="block-card-head">
        <span class="block-icon">${item.icon}</span><strong>${item.label}</strong>
        <div class="block-tools">
          <button type="button" class="icon-button" data-action="move" data-index="${index}" data-dir="-1" title="Subir" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="icon-button" data-action="move" data-index="${index}" data-dir="1" title="Descer" ${index === draft.blocos.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="icon-button" data-action="duplicate" data-index="${index}" title="Duplicar">⧉</button>
          <button type="button" class="icon-button icon-button--danger" data-action="remove" data-index="${index}" title="Remover bloco">✕</button>
        </div>
      </header>
      ${body}
    </article>`;
}

function reviewFields() {
  const review = draft.review;
  return `
    <section class="review-edit">
      <div class="review-edit-score">
        <span class="field-label">Nota</span>
        <output id="nota-output">${nota(review.nota)}</output>
        <input type="range" min="0" max="5" step="0.5" data-path="review.nota" data-kind="number" value="${review.nota}" aria-label="Nota de 0 a 5" />
        <div class="review-edit-stars" id="nota-stars">${stars(review.nota)}</div>
      </div>
      <div>
        ${field("review.veredito", "Veredito em uma frase", review.veredito, "Vale cada centavo, mas…")}
        <div class="field-row">
          ${field("review.pros", "Amamos (um por linha)", review.pros.join("\n"), "Bateria dura o dia todo", { multiline: true, kind: "lines" })}
          ${field("review.contras", "Nem tanto (um por linha)", review.contras.join("\n"), "Caixa frágil", { multiline: true, kind: "lines" })}
        </div>
      </div>
    </section>`;
}

const stars = (value) => Array.from({ length: 5 }, (_, index) => `<span style="--fill:${Math.max(0, Math.min(1, value - index)) * 100}%">★</span>`).join("");
const tagChips = () => draft.tags.map((tag) => `<span>#${h(tag)}</span>`).join("");

function cardPreview() {
  const cat = category(draft.category);
  const badge = draft.formato !== "materia" ? `${formatoLabel(draft.formato)}${draft.formato === "review" ? ` ★ ${nota(draft.review.nota)}` : ""}` : "";
  return `
    <article class="article-card">
      <span class="card-image-link">${draft.image ? `<img class="card-image" src="${h(imgUrl(draft.image))}" alt="" />` : `<span class="card-image card-image--empty">capa</span>`}${badge ? `<span class="format-badge">${h(badge)}</span>` : ""}</span>
      <div class="card-copy">
        <div class="card-meta">${cat ? `<span class="category-label">${cat.icon}${h(cat.name)}</span>` : `<span class="category-label">Sem categoria</span>`}</div>
        <h3 class="card-title">${h(draft.title || "Seu título aqui")}</h3>
        <p class="card-summary">${h(draft.summary || "O trecho de chamada aparece aqui.")}</p>
      </div>
    </article>`;
}

function serpPreview() {
  const title = (draft.seoTitle || draft.title || "Título da matéria").slice(0, 70);
  const description = (draft.seoDescription || draft.summary || "Descrição que aparece no Google.").slice(0, 170);
  const slug = draft.slug || draft.slugInput || slugify(draft.title) || "nova-postagem";
  return `<small>${h(location.host)}${h(base)}/${h(slug)}/</small><strong>${h(title)} — Somos Inventário</strong><p>${h(description)}</p>`;
}

function blocksHtml(blocos) {
  return blocos.filter((bloco) => !blockIsEmpty(bloco)).map((bloco) => {
    switch (bloco.tipo) {
      case "texto": return paragraphs(bloco.texto).map((html) => `<p>${html}</p>`).join("");
      case "subtitulo": return `<h2>${h(bloco.texto)}</h2>`;
      case "imagem": return `<figure class="block-figure ${bloco.largura === "larga" ? "block-figure--wide" : ""}"><img src="${h(imgUrl(bloco.src))}" alt="${h(bloco.alt)}" />${bloco.legenda ? `<figcaption>${h(bloco.legenda)}</figcaption>` : ""}</figure>`;
      case "galeria": return `<div class="block-gallery" data-count="${Math.min(bloco.imagens.length, 3)}">${bloco.imagens.map((imagem) => `<figure><img src="${h(imgUrl(imagem.src))}" alt="${h(imagem.alt ?? "")}" />${imagem.legenda ? `<figcaption>${h(imagem.legenda)}</figcaption>` : ""}</figure>`).join("")}</div>`;
      case "trecho": return `<blockquote class="block-quote"><p>${inline(bloco.texto)}</p>${bloco.fonte ? `<cite>— ${h(bloco.fonte)}</cite>` : ""}</blockquote>`;
      case "dica": return `<aside class="block-tip"><span class="eyebrow">${h(bloco.titulo || "Anota aí")}</span>${paragraphs(bloco.texto).map((html) => `<p>${html}</p>`).join("")}</aside>`;
      case "lista": {
        const tag = bloco.numerada ? "ol" : "ul";
        return `<${tag} class="block-list ${bloco.numerada ? "block-list--ranked" : ""}">${bloco.itens.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`;
      }
      case "produto": return `<div class="block-product">${bloco.imagem ? `<img src="${h(imgUrl(bloco.imagem))}" alt="" />` : ""}<div class="block-product-copy"><span class="eyebrow">Achadinho${bloco.loja ? ` · ${h(bloco.loja)}` : ""}</span><strong>${h(bloco.nome)}</strong>${bloco.nota ? `<p>${inline(bloco.nota)}</p>` : ""}<div class="block-product-row">${bloco.preco ? `<span class="block-product-price">${h(bloco.preco)}</span>` : ""}${bloco.link ? `<a class="button-link" href="${h(bloco.link)}" target="_blank" rel="noreferrer">Ver na loja ↗</a>` : ""}</div></div></div>`;
      case "video": {
        const id = youtubeId(bloco.url);
        return `<figure class="block-video">${id ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vídeo" allowfullscreen></iframe>` : `<p>Link de vídeo não reconhecido.</p>`}${bloco.legenda ? `<figcaption>${h(bloco.legenda)}</figcaption>` : ""}</figure>`;
      }
      case "pergunta": return `<div class="block-qa"><p class="block-qa-q"><span aria-hidden="true">P.</span>${h(bloco.pergunta)}</p>${paragraphs(bloco.resposta).map((html) => `<p>${html}</p>`).join("")}</div>`;
      case "divisor": return `<div class="block-divider"><span></span><span></span><span></span></div>`;
      default: return "";
    }
  }).join("");
}

function articlePreview() {
  const cat = category(draft.category);
  const review = draft.review;
  const minutes = Math.max(1, Math.round(blockWords() / 200));
  return `
    <div class="preview-frame">
      <div class="preview-label">Pré-visualização · é assim que fica no site</div>
      <div class="container">
        <header class="article-heading">
          <div class="article-kicker">${cat ? `<span class="category-label">${cat.icon}${h(cat.name)}</span>` : ""}${draft.formato !== "materia" ? `<span class="format-tag">${h(formatoLabel(draft.formato))}</span>` : ""}</div>
          <h1>${h(draft.title || "Seu título aqui")}</h1>
          <p class="article-deck">${h(draft.summary)}</p>
          <div class="article-byline">
            <div class="article-published"><time>${dateLabel(draft.date)}</time><span>${minutes} min de leitura</span></div>
          </div>
        </header>
      </div>
      ${draft.image ? `<figure class="article-cover container"><img src="${h(imgUrl(draft.image))}" alt="${h(draft.imageAlt)}" /><figcaption>${h(draft.imageAlt)}${draft.imageCredit ? `<span>${h(draft.imageCredit)}</span>` : ""}</figcaption></figure>` : ""}
      <div class="article-layout container"><article class="article-body">
        ${blocksHtml(draft.blocos)}
        ${draft.formato === "review" ? `<section class="review-box"><div class="review-score"><span class="eyebrow">Nota do inventário</span><strong>${nota(review.nota)}<small>/5</small></strong><span class="review-stars">${stars(review.nota)}</span></div><div class="review-copy">${review.veredito ? `<p class="review-verdict">${h(review.veredito)}</p>` : ""}<div class="review-lists">${review.pros.length ? `<div><span class="eyebrow">Amamos</span><ul>${review.pros.map((item) => `<li>${h(item)}</li>`).join("")}</ul></div>` : ""}${review.contras.length ? `<div><span class="eyebrow">Nem tanto</span><ul>${review.contras.map((item) => `<li>${h(item)}</li>`).join("")}</ul></div>` : ""}</div></div></section>` : ""}
      </article></div>
    </div>`;
}

const blockWords = () => draft.blocos.reduce((total, bloco) => total + words([bloco.texto, bloco.pergunta, bloco.resposta, bloco.nome, bloco.nota, ...(bloco.itens ?? [])].filter(Boolean).join(" ")), 0);

// Atualiza contadores, card e prévia do Google sem redesenhar o editor (mantém o foco).
function refreshLive() {
  if (!draft) return;
  const counters = { summary: [draft.summary, 180], seoTitle: [draft.seoTitle || draft.title, 60], seoDescription: [draft.seoDescription || draft.summary, 160] };
  for (const [name, [text = "", max]] of Object.entries(counters)) {
    const counter = document.querySelector(`[data-counter="${name}"]`);
    if (counter) {
      counter.textContent = `${text.length}/${max}`;
      counter.classList.toggle("is-over", text.length > max);
    }
  }
  const total = blockWords();
  const wordCount = document.querySelector("#word-count");
  if (wordCount) wordCount.textContent = `${total} ${total === 1 ? "palavra" : "palavras"} · ${Math.max(1, Math.round(total / 200))} min de leitura`;
  const card = document.querySelector("#card-preview");
  if (card) card.innerHTML = cardPreview();
  const serp = document.querySelector("#serp");
  if (serp) serp.innerHTML = serpPreview();
  const chips = document.querySelector("#tag-chips");
  if (chips) chips.innerHTML = tagChips();
  const output = document.querySelector("#nota-output");
  if (output) {
    output.textContent = nota(draft.review.nota);
    document.querySelector("#nota-stars").innerHTML = stars(draft.review.nota);
  }
}

function autosize(root = view) {
  for (const area of root.querySelectorAll("textarea")) {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight + 2}px`;
  }
}

/* ---------- imagens ---------- */

// Reduz para no máximo 1800 px e converte em WebP no próprio navegador (GIF e SVG passam como estão).
async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Esse arquivo não é uma imagem.");
  let blob = file;
  let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  if (!/gif|svg/.test(file.type)) {
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error("Não consegui abrir essa imagem. Tente JPG, PNG ou WebP.");
    });
    const scale = Math.min(1, 1800 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (webp && webp.type === "image/webp") {
      blob = webp;
      ext = "webp";
    } else {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      ext = "jpg";
    }
  }
  if (blob.size > 20 * 1024 * 1024) throw new Error("Imagem grande demais (máximo 20 MB).");
  const name = `${slugify(file.name.replace(/\.[^.]+$/, "")) || "imagem"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${ext}`;
  // Caminho provisório; ao salvar, a imagem sobe para o bucket e ganha a URL pública.
  const src = `pendente:${new Date().getFullYear()}/${name}`;
  pending.set(src, blob);
  previews.set(src, URL.createObjectURL(blob));
  return src;
}

function pickFiles({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.querySelector("#file-input");
    input.multiple = multiple;
    input.value = "";
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

async function setImage(path, file) {
  try {
    toast("Preparando imagem…");
    const src = await prepareImage(file);
    setPath(draft, path, src);
    markDirty();
    renderEditor();
    toast("Imagem pronta. Ela sobe junto quando você salvar.");
  } catch (error) {
    toast(error.message, "error");
  }
}

/* ---------- salvar ---------- */

function uniqueSlug(wanted, current) {
  let slug = RESERVED.includes(wanted) ? `${wanted}-post` : wanted;
  let n = 2;
  while (posts.some((post) => post.slug === slug && post.slug !== current)) slug = `${wanted}-${n++}`;
  return slug;
}

function validate(publishing) {
  const errors = [];
  if (!draft.title.trim()) errors.push("Dê um título para a postagem.");
  if (publishing) {
    if (!draft.summary.trim()) errors.push("Escreva o trecho de chamada.");
    if (!draft.image) errors.push("Escolha uma imagem de capa.");
    if (!draft.category) errors.push("Escolha a categoria.");
    if (!draft.blocos.some((bloco) => !blockIsEmpty(bloco))) errors.push("O corpo da matéria está vazio.");
  }
  const box = document.querySelector("#form-errors");
  box.hidden = errors.length === 0;
  box.innerHTML = errors.map((error) => `<li>${h(error)}</li>`).join("");
  if (errors.length) box.scrollIntoView({ behavior: "smooth", block: "center" });
  return errors.length === 0;
}

async function save(publishing) {
  if (!validate(publishing)) return;
  // "Salvar rascunho" numa postagem que está no ar tira ela do site.
  if (!publishing && draft.existing && !draft.rascunho && !window.confirm("Essa postagem está no ar. Salvar como rascunho tira ela do site até você publicar de novo. Continuar?")) return;
  const buttons = view.querySelectorAll(".editor-bar button");
  buttons.forEach((button) => (button.disabled = true));
  const state = document.querySelector("#editor-state");
  state.textContent = "Salvando…";
  const slug = draft.existing ? draft.slug : uniqueSlug(draft.slugInput || slugify(draft.title) || "nova-postagem");
  const previous = posts.find((item) => item.slug === slug);
  const data = {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    date: new Date(draft.date).toISOString(),
    category: draft.category,
    formato: draft.formato,
    image: draft.image,
    imageAlt: draft.imageAlt.trim(),
    imageCredit: draft.imageCredit?.trim() || undefined,
    onde: draft.onde,
    tags: draft.tags,
    review: draft.formato === "review" ? { nota: Number(draft.review.nota), veredito: draft.review.veredito?.trim() || undefined, pros: draft.review.pros, contras: draft.review.contras } : undefined,
    seoTitle: draft.seoTitle?.trim() || undefined,
    seoDescription: draft.seoDescription?.trim() || undefined,
    rascunho: !publishing,
    blocos: draft.blocos.filter((bloco) => !blockIsEmpty(bloco)).map(cleanBlock),
  };
  let serialized = JSON.stringify(data);
  const images = [...pending.keys()].filter((src) => serialized.includes(src));
  // Uma cópia local recuperada depois de recarregar a página não traz mais o arquivo da imagem.
  if ((serialized.match(/"pendente:[^"]+"/g) ?? []).some((match) => !pending.has(JSON.parse(match)))) {
    toast("Uma imagem desta versão recuperada se perdeu ao recarregar a página. Escolha ela de novo e salve.", "error");
    state.textContent = "Falta uma imagem";
    buttons.forEach((button) => (button.disabled = false));
    return;
  }
  try {
    // Primeiro sobem as imagens novas; o texto passa a apontar para a URL pública de cada uma.
    for (const src of images) {
      const path = src.slice("pendente:".length);
      const { error } = await supabase.storage.from(BUCKET).upload(path, pending.get(src), { contentType: pending.get(src).type, upsert: false });
      if (error) throw error;
      const { publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path).data;
      serialized = serialized.split(JSON.stringify(src).slice(1, -1)).join(publicUrl);
      previews.set(publicUrl, previews.get(src));
      pending.delete(src);
    }
    const saved = JSON.parse(serialized);
    // Campos opcionais apagados no editor também precisam ser apagados no banco.
    const row = { ...toRow({ imageCredit: null, review: null, seoTitle: null, seoDescription: null, ...saved }), slug, updated_at: new Date().toISOString() };
    const { error } = draft.existing
      ? await supabase.from("posts").update(row).eq("slug", slug)
      : await supabase.from("posts").insert(row);
    if (error) throw error.code === "23505" ? new Error("já existe uma postagem com esse endereço. Troque o endereço e salve de novo.") : error;
    // Imagens que saíram da postagem não ficam sobrando no bucket.
    if (previous) await removeImages(imagesOf(previous.data).filter((path) => !imagesOf(saved).includes(path)));
    try { localStorage.removeItem(draftKey()); } catch { /* ignora */ }
    const post = { slug, data: saved };
    posts = sortPosts([post, ...posts.filter((item) => item.slug !== slug)]);
    dirty = false;
    toast(publishing ? `Publicado! ${SITE_DELAY}` : `Rascunho salvo.${previous && !previous.data.rascunho ? ` A postagem sai do ar. ${SITE_DELAY}` : ""}`);
    if (location.hash !== `#/editar/${slug}`) {
      history.replaceState(null, "", `#/editar/${slug}`);
      lastHash = location.hash;
    }
    draft = draftFromPost(post);
    renderEditor();
  } catch (error) {
    toast(`Não deu pra salvar: ${error.message}`, "error");
    state.textContent = "Erro ao salvar";
    buttons.forEach((button) => (button.disabled = false));
  }
}

/* ---------- eventos ---------- */

view.addEventListener("input", (event) => {
  const target = event.target;
  const path = target.dataset?.path;
  if (!draft || !path) return;
  const kind = target.dataset.kind;
  let value = target.value;
  if (kind === "lines") value = value.split("\n").map((line) => line.trim()).filter(Boolean);
  else if (kind === "tags") value = value.split(",").map((tag) => tag.trim()).filter(Boolean);
  else if (kind === "number") value = Number(value);
  else if (kind === "date") value = value ? new Date(value).toISOString() : new Date().toISOString();
  else if (kind === "bool") value = target.checked;
  else if (kind === "wide") value = target.checked ? "larga" : "normal";
  else if (kind === "slug") value = slugify(value);
  setPath(draft, path, value);
  if (target.tagName === "TEXTAREA") autosize(target.parentElement);
  markDirty();
});

view.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;
  const index = Number(button.dataset.index);

  if (action === "filter") {
    listFilter = button.dataset.value;
    renderList();
  } else if (action === "delete-post") {
    deletePost(button.dataset.slug);
  } else if (action === "delete-current") {
    dirty = false;
    await deletePost(draft.slug);
    if (!posts.some((post) => post.slug === draft?.slug)) location.hash = "#/";
  } else if (action === "formato") {
    const empty = !draft.existing && draft.blocos.every(blockIsEmpty);
    draft.formato = button.dataset.value;
    if (empty) draft.blocos = TEMPLATES[draft.formato]();
    markDirty();
    renderEditor();
    if (empty && draft.formato !== "materia") toast(`Montamos um esqueleto de ${formatoLabel(draft.formato).toLowerCase()} pra você.`);
  } else if (action === "category") {
    draft.category = button.dataset.value;
    view.querySelectorAll("[data-action=category]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    markDirty();
  } else if (action === "onde") {
    draft.onde = [...view.querySelectorAll("[data-action=onde]:checked")].map((item) => item.value);
    markDirty();
  } else if (action === "open-inserter") {
    const menu = button.nextElementSibling;
    view.querySelectorAll(".inserter-menu").forEach((item) => item !== menu && (item.hidden = true));
    menu.hidden = !menu.hidden;
  } else if (action === "add-block") {
    const at = Number(button.dataset.at);
    draft.blocos.splice(at, 0, BLOCKS[button.dataset.type].make());
    markDirty();
    renderEditor();
    const card = view.querySelectorAll(".block-card")[at];
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector("input, textarea")?.focus({ preventScroll: true });
    if (["imagem"].includes(button.dataset.type)) {
      const [file] = await pickFiles();
      if (file) setImage(`blocos.${at}.src`, file);
    }
  } else if (action === "move") {
    const to = index + Number(button.dataset.dir);
    [draft.blocos[index], draft.blocos[to]] = [draft.blocos[to], draft.blocos[index]];
    markDirty();
    renderEditor();
    view.querySelectorAll(".block-card")[to]?.scrollIntoView({ block: "center" });
  } else if (action === "duplicate") {
    draft.blocos.splice(index + 1, 0, structuredClone(draft.blocos[index]));
    markDirty();
    renderEditor();
  } else if (action === "remove") {
    const bloco = draft.blocos[index];
    if (!blockIsEmpty(bloco) && !window.confirm("Remover este bloco?")) return;
    draft.blocos.splice(index, 1);
    markDirty();
    renderEditor();
  } else if (action === "pick-image") {
    const [file] = await pickFiles();
    if (file) setImage(button.dataset.path, file);
  } else if (action === "clear-image") {
    setPath(draft, button.dataset.path, "");
    markDirty();
    renderEditor();
  } else if (action === "gallery-add") {
    const files = await pickFiles({ multiple: true });
    if (!files.length) return;
    toast(`Preparando ${files.length} ${files.length === 1 ? "imagem" : "imagens"}…`);
    for (const file of files) {
      try {
        draft.blocos[index].imagens.push({ src: await prepareImage(file), alt: "", legenda: "" });
      } catch (error) {
        toast(error.message, "error");
      }
    }
    markDirty();
    renderEditor();
  } else if (action === "gallery-remove") {
    draft.blocos[index].imagens.splice(Number(button.dataset.at), 1);
    markDirty();
    renderEditor();
  } else if (action === "toggle-preview") {
    showPreview = !showPreview;
    renderEditor();
    window.scrollTo({ top: 0 });
  } else if (action === "save-draft") {
    save(false);
  } else if (action === "publish") {
    save(true);
  } else if (action === "restore") {
    const saved = JSON.parse(localStorage.getItem(draftKey()));
    draft = { ...saved.draft, existing: draft.existing };
    dirty = true;
    renderEditor();
    toast("Versão recuperada. Lembre de salvar.");
  } else if (action === "discard-local") {
    try { localStorage.removeItem(draftKey()); } catch { /* ignora */ }
    document.querySelector("#restore").hidden = true;
  }
});

// Arrastar imagem direto para a capa ou para um bloco de imagem.
view.addEventListener("dragover", (event) => {
  const zone = event.target.closest("[data-drop]");
  if (!zone) return;
  event.preventDefault();
  zone.classList.add("is-over");
});
view.addEventListener("dragleave", (event) => event.target.closest("[data-drop]")?.classList.remove("is-over"));
view.addEventListener("drop", (event) => {
  const zone = event.target.closest("[data-drop]");
  if (!zone) return;
  event.preventDefault();
  const [file] = event.dataTransfer.files;
  if (file) setImage(zone.dataset.drop, file);
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-action=logout]")) {
    if (dirty && !window.confirm("Sair sem salvar as mudanças?")) return;
    dirty = false;
    supabase.auth.signOut().finally(() => window.location.replace(pages.entrar));
  }
  if (!event.target.closest(".inserter")) view.querySelectorAll(".inserter-menu").forEach((menu) => (menu.hidden = true));
  if (!event.target.closest(".user-menu")) document.querySelector(".user-menu")?.removeAttribute("open");
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && draft) {
    event.preventDefault();
    // Ctrl+S atualiza o que já está no ar; o resto vira rascunho.
    save(Boolean(draft.existing && !draft.rascunho));
  }
});

window.addEventListener("beforeunload", (event) => {
  if (dirty) event.preventDefault();
});

/* ---------- rotas ---------- */

let lastHash = location.hash;
function route() {
  const hash = location.hash || "#/";
  if (dirty && hash !== lastHash && !window.confirm("Você tem mudanças não salvas (ficam guardadas neste navegador). Sair mesmo assim?")) {
    history.replaceState(null, "", lastHash);
    return;
  }
  dirty = false;
  lastHash = hash;
  window.scrollTo({ top: 0 });
  const [, page, slug] = hash.split("/");
  if (page === "nova") openEditor(null);
  else if (page === "editar" && slug) openEditor(decodeURIComponent(slug));
  else {
    draft = null;
    renderList();
  }
}

// Conta criada mas ainda não liberada em public.editores (ver supabase/schema.sql).
function renderWaiting() {
  document.querySelector(".panel-nav").hidden = true;
  view.innerHTML = `<div class="dash-empty"><img src="${config.mark}" alt="" width="60" height="80" /><h2>Quase lá, <em>${h(firstName(userName()))}</em>.</h2><p>Sua conta (${h(user.email)}) foi criada, mas ainda não tem acesso para publicar. Peça para quem administra a Redação liberar seu e-mail.</p><button class="primary-button" type="button" onclick="location.reload()"><span>Já liberaram, tentar de novo</span></button></div>`;
}

async function start() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.replace(pages.entrar);
    return;
  }
  user = data.session.user;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") window.location.replace(pages.entrar);
  });
  renderUser();
  try {
    const { data: editor, error } = await supabase.rpc("is_editor");
    if (error) throw error;
    if (!editor) return renderWaiting();
    await loadAll();
  } catch (error) {
    view.innerHTML = `<div class="dash-empty"><h2>Não deu pra abrir a <em>redação</em>.</h2><p>${h(error.message)}</p><button class="primary-button" type="button" onclick="location.reload()"><span>Tentar de novo</span></button></div>`;
    return;
  }
  window.addEventListener("hashchange", route);
  route();
}

start();
