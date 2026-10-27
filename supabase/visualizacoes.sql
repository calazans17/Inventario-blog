-- Visualizações das postagens. Rode no SQL Editor do Supabase depois do schema.sql
-- (pode rodar de novo sem problema). Quem visita o site só consegue somar +1 numa
-- postagem publicada; os números só aparecem para a equipe, no /painel.

-- Um total por postagem por dia (dia no horário de Brasília).
create table if not exists public.visualizacoes (
  post_slug text not null references public.posts (slug) on delete cascade on update cascade,
  dia date not null,
  total integer not null default 0,
  primary key (post_slug, dia)
);

alter table public.visualizacoes enable row level security;
drop policy if exists "visualizacoes: leitura da equipe" on public.visualizacoes;
create policy "visualizacoes: leitura da equipe" on public.visualizacoes for select to authenticated using (public.is_editor());
grant select on public.visualizacoes to authenticated;

-- Chamada pela página da matéria. Ignora rascunhos e endereços que não existem.
create or replace function public.registrar_visualizacao(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visualizacoes (post_slug, dia, total)
  select slug, (now() at time zone 'America/Sao_Paulo')::date, 1
  from public.posts
  where slug = p_slug and rascunho = false
  on conflict (post_slug, dia) do update set total = visualizacoes.total + 1;
$$;

-- Resumo para o painel: total, últimos 7 dias e hoje de cada postagem. Vazio para quem não é da equipe.
create or replace function public.resumo_visualizacoes()
returns table (post_slug text, total bigint, ultimos_7 bigint, hoje bigint)
language sql
stable
security definer
set search_path = public
as $$
  with agora as (select (now() at time zone 'America/Sao_Paulo')::date as dia)
  select v.post_slug,
    sum(v.total),
    coalesce(sum(v.total) filter (where v.dia > agora.dia - 7), 0),
    coalesce(sum(v.total) filter (where v.dia = agora.dia), 0)
  from public.visualizacoes v, agora
  where public.is_editor()
  group by v.post_slug;
$$;

revoke execute on function public.registrar_visualizacao(text) from public;
revoke execute on function public.resumo_visualizacoes() from public;
grant execute on function public.registrar_visualizacao(text) to anon, authenticated;
grant execute on function public.resumo_visualizacoes() to authenticated;
