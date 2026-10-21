// Cliente mínimo da API do GitHub para a Redação. Roda no navegador com o token
// de quem fez login; cada salvamento vira um único commit na main (que dispara o deploy).
const API = "https://api.github.com";
const BRANCH = "main";

export class GithubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const utf8ToBase64 = (text) => bytesToBase64(new TextEncoder().encode(text));
export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
const base64ToUtf8 = (base64) => new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g, "")), (char) => char.charCodeAt(0)));

export function createClient(token, repo) {
  async function api(path, { method = "GET", body } = {}) {
    const response = await fetch(`${API}${path}`, {
      method,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = response.status === 403 && /personal access token/i.test(data.message ?? "")
        ? "o token não tem permissão de escrita. Edite o token no GitHub e troque Contents para \"Read and write\"."
        : data.message || response.statusText;
      throw new GithubError(response.status, message);
    }
    return response.status === 204 ? null : response.json();
  }

  async function list(dir) {
    try {
      return (await api(`/repos/${repo}/contents/${dir}?ref=${BRANCH}`)).filter((item) => item.type === "file");
    } catch (error) {
      if (error.status === 404) return [];
      throw error;
    }
  }

  async function read(path) {
    const file = await api(`/repos/${repo}/contents/${path}?ref=${BRANCH}`);
    return base64ToUtf8(file.content);
  }

  // files: [{ path, text } | { path, base64 }]; remove: [path]
  async function commit(message, { files = [], remove = [] }, retry = true) {
    const ref = await api(`/repos/${repo}/git/ref/heads/${BRANCH}`);
    const parent = await api(`/repos/${repo}/git/commits/${ref.object.sha}`);
    const blobs = await Promise.all(files.map(async (file) => {
      const blob = await api(`/repos/${repo}/git/blobs`, { method: "POST", body: { content: file.base64 ?? utf8ToBase64(file.text), encoding: "base64" } });
      return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
    }));
    const tree = await api(`/repos/${repo}/git/trees`, { method: "POST", body: { base_tree: parent.tree.sha, tree: [...blobs, ...remove.map((path) => ({ path, mode: "100644", type: "blob", sha: null }))] } });
    const created = await api(`/repos/${repo}/git/commits`, { method: "POST", body: { message, tree: tree.sha, parents: [parent.sha] } });
    try {
      await api(`/repos/${repo}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: { sha: created.sha } });
    } catch (error) {
      // Alguém salvou ao mesmo tempo: refaz em cima do commit mais novo.
      if (retry && error.status === 422) return commit(message, { files, remove }, false);
      throw error;
    }
    return created;
  }

  return {
    repo,
    user: () => api("/user"),
    repository: () => api(`/repos/${repo}`),
    // Testa se o token pode escrever: um blob vazio não entra em nenhum commit e o GitHub descarta depois.
    canWrite: () => api(`/repos/${repo}/git/blobs`, { method: "POST", body: { content: "", encoding: "utf-8" } }).then(() => true, (error) => (error.status === 403 || error.status === 404 ? false : Promise.reject(error))),
    list,
    read,
    commit,
    // Precisa da permissão "Actions: read" no token; sem ela devolve null.
    latestRun: () => api(`/repos/${repo}/actions/runs?branch=${BRANCH}&per_page=1`).then((data) => data.workflow_runs[0] ?? null).catch(() => null),
  };
}
