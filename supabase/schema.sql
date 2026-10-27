-- Banco do Somos Inventário. Rode uma vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (não apaga nada).

-- Postagens. O site lê as publicadas no build; a Redação (/painel) lê e grava tudo.
create table if not exists public.posts (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text not null default '',
  date timestamptz not null default now(),
  category text not null default '',
  formato text not null default 'materia' check (formato in ('materia', 'review', 'lista', 'guia', 'entrevista', 'opiniao')),
  image text not null default '',
  image_alt text not null default '',
  image_credit text,
  onde text[] not null default '{}',
  tags text[] not null default '{}',
  blocos jsonb not null default '[]',
  review jsonb,
  seo_title text,
  seo_description text,
  rascunho boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Quem pode publicar. Qualquer pessoa pode criar conta em /cadastro, mas só escreve
-- quem estiver nesta tabela (veja "Liberar uma conta" no fim do arquivo).
create table if not exists public.editores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.editores where user_id = auth.uid());
$$;

alter table public.posts enable row level security;
alter table public.editores enable row level security;

drop policy if exists "posts: leitura" on public.posts;
create policy "posts: leitura" on public.posts for select using (rascunho = false or public.is_editor());
drop policy if exists "posts: escrita" on public.posts;
create policy "posts: escrita" on public.posts for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists "editores: a própria linha" on public.editores;
create policy "editores: a própria linha" on public.editores for select to authenticated using (user_id = auth.uid());

grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant select on public.editores to authenticated;
grant execute on function public.is_editor() to anon, authenticated;

-- Imagens das postagens (capa, blocos, galeria). Leitura pública, envio só da equipe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 20971520, array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

-- O bucket público já serve as imagens no site; esta leitura é para a equipe poder trocar e remover.
drop policy if exists "imagens: leitura da equipe" on storage.objects;
create policy "imagens: leitura da equipe" on storage.objects for select to authenticated using (bucket_id = 'imagens' and public.is_editor());
drop policy if exists "imagens: envio da equipe" on storage.objects;
create policy "imagens: envio da equipe" on storage.objects for insert to authenticated with check (bucket_id = 'imagens' and public.is_editor());
drop policy if exists "imagens: troca da equipe" on storage.objects;
create policy "imagens: troca da equipe" on storage.objects for update to authenticated using (bucket_id = 'imagens' and public.is_editor());
drop policy if exists "imagens: remoção da equipe" on storage.objects;
create policy "imagens: remoção da equipe" on storage.objects for delete to authenticated using (bucket_id = 'imagens' and public.is_editor());

-- Liberar uma conta (depois que a pessoa se cadastrar e confirmar o e-mail):
--   insert into public.editores (user_id) select id from auth.users where email = 'email@da.pessoa';
