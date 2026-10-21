# Somos Inventário

Portal editorial estático (Astro 7) publicado no GitHub Pages, com uma Redação própria em `/painel` (login em `/entrar`) para escrever e publicar postagens.

## Rodar localmente

Requisito: Node.js 22.12+.

```sh
npm install
npm run dev        # http://localhost:4321/
npm run build      # gera dist/
```

## Publicação (GitHub Pages)

O workflow `.github/workflows/deploy.yml` faz o build e publica a cada push na `main`, inclusive os commits feitos pela Redação. O endereço e o caminho base (`/nome-do-repo/`) vêm do próprio GitHub Pages, sem configuração manual.

Primeira vez: no repositório, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Domínio próprio depois: configure em Settings → Pages; o workflow passa a gerar o site na raiz automaticamente.

## Redação (`/entrar` → `/painel`)

O site não tem servidor, então o login é feito com um token do GitHub de cada pessoa. O token fica só no navegador e a Redação fala direto com a API do GitHub: cada salvamento vira **um commit** na `main` (texto + imagens juntos), que dispara o deploy.

Gerar o token (`/entrar` tem o passo a passo):

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. Repository access: só este repositório.
3. Permissions → **Contents: Read and write**. Opcional: **Actions: Read**, para a Redação mostrar "Publicando… / No ar ✓".

Só entra quem tem permissão de escrita no repositório. No primeiro acesso a Redação pede o perfil de autor (nome, função, bio e foto, com o avatar do GitHub como padrão), salvo em `src/content/autores/<login>.json`.

### Escrevendo

- **Formato**: Matéria, Review (nota de 0 a 5, veredito, prós e contras), Lista, Guia, Entrevista ou Opinião. O formato vira um selo nos cards; numa postagem nova, escolher o formato monta um esqueleto de blocos.
- **Blocos do corpo**: texto (com `**negrito**`, `_itálico_` e `[link](https://...)`), subtítulo, imagem (normal ou larga), galeria, trecho em destaque, caixa de dica, lista/ranking, achadinho (foto, preço, loja e link), vídeo do YouTube, pergunta & resposta e divisor. Dá para inserir entre blocos, mover, duplicar e remover.
- **Imagens**: escolher ou arrastar. São reduzidas para até 1800 px e convertidas em WebP no navegador antes de subir para `public/uploads/<ano>/`.
- Pré-visualização da página, prévia do card e do resultado no Google, contador de leitura, cópia local automática (para não perder texto) e `Ctrl+S`.
- **Salvar rascunho** grava sem publicar; **Publicar** confere título, chamada, capa, categoria, autor e corpo.

| "Onde aparece" | Lugar no site |
| --- | --- |
| Destaque principal | Card grande no topo da home (vale a mais recente marcada) |
| Em alta | Lista numerada ao lado do destaque (até 4) |
| Guias & achadinhos | Faixa vermelha da home (até 3) |
| Nada marcado | Últimas entradas, página da categoria, tags e busca |

As categorias têm ícone em pixel e ficam no código (`src/data/content.js`); a Redação lê a lista de lá no build.

## Identidade visual

- Paleta: `#B23B2F`, `#D25A4A`, `#E59686`, `#EDE7DC` e `#FBF8F2`, variáveis no topo de `src/styles/global.css`.
- Tipografia: DM Serif Display nos títulos e no wordmark; Jost no texto.
- Ícones em pixel das categorias e o "I" da marca ficam em `src/lib/pixel.js`.

## Estrutura

| Pasta/arquivo | O que tem |
| --- | --- |
| `src/content/` | Postagens e autores (editados pela Redação) |
| `src/content.config.ts` | Campos e blocos aceitos em cada postagem |
| `src/data/content.js` | Categorias, formatos, lugares da home e helpers de URL |
| `src/components/Blocks.astro` | Como cada bloco aparece na matéria |
| `src/pages/entrar.astro`, `src/pages/painel.astro` | Login e Redação |
| `src/scripts/` | Código da Redação (API do GitHub, sessão, editor) |
| `public/uploads/` | Imagens enviadas pela Redação |

Rotas: `/`, `/{slug}/`, `/categoria/{slug}/`, `/tag/{slug}/`, `/autor/{slug}/`, `/busca/?q=termo`, `/entrar/`, `/painel/` (`/admin/` redireciona). `sitemap.xml` e `robots.txt` são gerados no build.

A newsletter ainda é só visual.
