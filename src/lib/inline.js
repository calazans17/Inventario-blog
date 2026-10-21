// Formatação de texto dos blocos, usada no site e na pré-visualização do /painel.
// Aceita **negrito**, _itálico_ e [link](https://...). Todo o resto é escapado.
export const escapeHtml = (text = "") => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeHref = (href) => (/^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : "#");

export function inline(text = "") {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const external = /^https?:/i.test(href);
      return `<a href="${safeHref(href)}"${external ? ` target="_blank" rel="noreferrer"` : ""}>${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\p{L}\p{N}])_(.+?)_(?=[^\p{L}\p{N}]|$)/gu, "$1<em>$2</em>")
    .replace(/\n/g, "<br />");
}

// Texto com linhas em branco vira vários parágrafos.
export const paragraphs = (text = "") => text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map(inline);

export function youtubeId(link = "") {
  const match = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return match?.[1];
}
