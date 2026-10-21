// Sessão da Redação: o token fica só neste navegador (localStorage com "lembrar",
// sessionStorage sem). Nada é enviado para outro lugar além da API do GitHub.
import { createClient } from "./github.js";

const KEY = "inventario:sessao";
const stores = () => [window.localStorage, window.sessionStorage];

export function getSession() {
  for (const store of stores()) {
    try {
      const raw = store.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* storage bloqueado */ }
  }
  return null;
}

export function saveSession(session, remember) {
  clearSession();
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch { /* storage bloqueado: a sessão dura só esta página */ }
}

export function clearSession() {
  for (const store of stores()) {
    try { store.removeItem(KEY); } catch { /* ignora */ }
  }
}

// Valida o token: precisa abrir o repositório e ter permissão de escrita.
export async function signIn(token, repo) {
  const client = createClient(token, repo);
  let user;
  try {
    user = await client.user();
  } catch (error) {
    throw new Error(error.status === 401 ? "Esse token não funcionou. Confira se copiou inteiro e se não expirou." : "Não deu pra falar com o GitHub agora. Tenta de novo em instantes.");
  }
  let repository;
  try {
    repository = await client.repository();
  } catch {
    throw new Error(`O token entrou, mas não enxerga o repositório ${repo}. Em "Repository access", escolha esse repositório.`);
  }
  if (!repository.permissions?.push) throw new Error("Sua conta pode ler o repositório, mas não pode escrever. Peça acesso de escrita ou marque Contents: Read and write no token.");
  return { token, login: user.login, name: user.name || user.login, avatar: user.avatar_url, bio: user.bio || "" };
}
