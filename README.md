# Somos Inventário

Portal editorial estático (Astro 7) publicado no GitHub Pages. As postagens, o login da equipe e as imagens ficam no Supabase (plano grátis). A Redação fica em `/painel` (login em `/entrar`, cadastro em `/cadastro`).

## Rodar localmente

Requisito: Node.js 22.12+.

```sh
npm install
npm run dev        # http://localhost:4321/
npm run build      # gera dist/
```

O painel local grava no mesmo banco do site no ar: o que for publicado ali vai para o site no próximo deploy.

## Supabase

1. No projeto do Supabase: **SQL Editor → New query**, cole `supabase/schema.sql` e rode. Ele cria a tabela `posts`, a lista de quem pode publicar (`editores`), o bucket de imagens `imagens` e as regras de acesso.
2. **Authentication → URL Configuration**: em Site URL, o endereço do site no GitHub Pages; em Redirect URLs, adicione esse endereço com `/**` no fim e `http://localhost:4321/**`. É para onde o link de confirmação do e-mail leva.
3. Cada pessoa cria a conta em `/cadastro` e confirma o e-mail. Para liberar quem pode publicar, rode no SQL Editor:
   ```sql
   insert into public.editores (user_id) select id from auth.users where email = 'email@da.pessoa';
   ```

O endereço do projeto e a chave publicável ficam em `src/lib/supabase.js` (são públicos por natureza; quem protege os dados são as regras do `schema.sql`). Para usar outro projeto, defina `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Publicação (GitHub Pages)

O workflow `.github/workflows/deploy.yml` faz o build lendo as postagens publicadas no Supabase e publica o site:

- a cada push na `main`;
- de hora em hora (isso também mantém o projeto grátis do Supabase ativo, que pausa depois de 7 dias sem uso);
- na hora em que alguém salva na Redação, depois de rodar `supabase/deploy-trigger.sql` com um token do GitHub (passo a passo no arquivo);
- no botão **Actions → Publicar no GitHub Pages → Run workflow**.

Se o Supabase não responder, o build falha e o site no ar continua como estava.

Primeira vez: no repositório, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Domínio próprio depois: configure em Settings → Pages; o workflow passa a gerar o site na raiz automaticamente.

## Redação (`/entrar` → `/painel`)

Login por e-mail e senha (Supabase Auth). Qualquer pessoa consegue criar conta, mas só publica quem estiver em `editores`; as outras contas veem um aviso de "aguardando liberação".

### Escrevendo

- **Formato**: Matéria, Review (nota de 0 a 5, veredito, prós e contras), Lista, Guia, Entrevista ou Opinião. O formato vira um selo nos cards; numa postagem nova, escolher o formato monta um esqueleto de blocos.
- **Blocos do corpo**: texto (com `**negrito**`, `_itálico_` e `[link](https://...)`), subtítulo, imagem (normal ou larga), galeria, trecho em destaque, caixa de dica, lista/ranking, achadinho (foto, preço, loja e link), vídeo do YouTube, pergunta & resposta e divisor. Dá para inserir entre blocos, mover, duplicar e remover.
- **Imagens**: escolher ou arrastar. São reduzidas para até 1800 px e convertidas em WebP no navegador antes de subir para o bucket `imagens` do Supabase. Excluir uma postagem (ou tirar uma imagem dela) apaga o arquivo também.
- Pré-visualização da página, prévia do card e do resultado no Google, contador de leitura, cópia local automática (para não perder texto) e `Ctrl+S`.
- **Salvar rascunho** grava sem publicar (numa postagem que está no ar, pede confirmação, porque ela sai do site); **Publicar** confere título, chamada, capa, categoria e corpo.

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
| `supabase/` | SQL do banco (`schema.sql`) e do deploy automático (`deploy-trigger.sql`) |
| `src/lib/supabase.js` | Conexão com o Supabase e leitura das postagens no build |
| `src/content.config.ts` | Campos e blocos aceitos em cada postagem |
| `src/data/content.js` | Categorias, formatos, lugares da home e helpers de URL |
| `src/components/Blocks.astro` | Como cada bloco aparece na matéria |
| `src/pages/entrar.astro`, `cadastro.astro`, `painel.astro` | Login, cadastro e Redação |
| `src/scripts/` | Código da Redação (login e editor) |

Rotas: `/`, `/{slug}/`, `/categoria/{slug}/`, `/tag/{slug}/`, `/busca/?q=termo`, `/entrar/`, `/cadastro/`, `/painel/` (`/admin/` redireciona). `sitemap.xml` e `robots.txt` são gerados no build.

A newsletter ainda é só visual.
