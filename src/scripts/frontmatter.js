// Frontmatter das postagens. Cada valor é gravado como JSON, que também é YAML
// válido, então o Astro lê sem problema e o painel consegue ler de volta sem um parser YAML.
export function stringify(data, body = "") {
  const lines = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")}`);
  return `---\n${lines.join("\n")}\n---\n${body ? `\n${body.trim()}\n` : ""}`;
}

export function parse(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: source };
  const data = {};
  let key = null;
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (field) {
      key = field[1];
      data[key] = field[2];
    } else if (key) {
      data[key] += `\n${line}`;
    }
  }
  for (const [name, raw] of Object.entries(data)) data[name] = scalar(raw.trim());
  return { data, body: match[2].trim() };
}

function scalar(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'");
    return raw;
  }
}
