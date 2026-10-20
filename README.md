# Somos Inventário

Portal editorial estático (Astro 7) publicado no GitHub Pages, com painel em `/admin` para cadastrar postagens com imagens.

## Rodar localmente

Requisito: Node.js 22.12+.

```sh
npm install
npm run dev        # http://localhost:4321/
npm run build      # gera dist/
```

## Publicação (GitHub Pages)

O workflow `.github/workflows/deploy.yml` faz o build e publica a cada push na `main`, inclusive os commits feitos pelo painel. O endereço e o caminho base (`/nome-do-repo/`) vêm do próprio GitHub Pages, sem configuração manual.

Primeira vez: no repositório, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Domínio próprio depois: configure em Settings → Pages; o workflow passa a gerar o site na raiz automaticamente.

## Painel de postagens (`/admin`)

O painel é o [Sveltia CMS](https://github.com/sveltia/sveltia-cms). Ele salva direto no repositório: cada postagem vira um arquivo em `src/content/posts/`, cada autor um JSON em `src/content/autores/` e as imagens vão para `public/uploads/`. Depois de salvar, o site atualiza em 1–2 minutos (o tempo do Actions).

Para entrar, abra `https://<usuario>.github.io/<repo>/admin/`, escolha **Sign in with Token** e cole um token do GitHub:

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. Repository access: só este repositório.
3. Permissions → **Contents: Read and write**.

Cada pessoa da equipe usa o próprio token e precisa ter acesso de escrita ao repositório.

Campos de uma postagem: título, resumo, capa (upload), descrição e crédito da imagem, categoria, **onde aparece na home**, autor, data, tags, texto (com imagens no meio), SEO opcional e rascunho.

| "Onde aparece" | Lugar no site |
| --- | --- |
| Destaque principal | Card grande no topo da home (vale a mais recente marcada) |
| Em alta | Lista numerada ao lado do destaque (até 4) |
| Guias & achadinhos | Faixa vermelha da home (até 3) |
| Nada marcado | Últimas entradas, página da categoria, tags e busca |

As categorias têm ícone em pixel e ficam no código (`src/data/content.js`); o painel lê a lista de lá.

## Identidade visual

- Paleta: `#B23B2F`, `#D25A4A`, `#E59686`, `#EDE7DC` e `#FBF8F2`, variáveis no topo de `src/styles/global.css`.
- Tipografia: DM Serif Display nos títulos e no wordmark; Jost no texto.
- Ícones em pixel das categorias e o "I" da marca ficam em `src/lib/pixel.js`.

## Estrutura

| Pasta/arquivo | O que tem |
| --- | --- |
| `src/content/` | Postagens e autores (editados pelo painel) |
| `src/content.config.ts` | Campos aceitos em cada postagem |
| `src/data/content.js` | Categorias, lugares da home e helpers de URL |
| `src/pages/admin/` | Painel e a configuração dele |
| `public/uploads/` | Imagens enviadas pelo painel |

Rotas: `/`, `/{slug}/`, `/categoria/{slug}/`, `/tag/{slug}/`, `/autor/{slug}/`, `/busca/?q=termo`. `sitemap.xml` e `robots.txt` são gerados no build.

## Conteúdo de demonstração

As postagens e os autores atuais são fictícios, com fotos do Unsplash. Apague pelo painel antes de lançar. A newsletter ainda é só visual.
