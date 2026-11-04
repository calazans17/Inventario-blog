-- Newsletter: e-mails de quem pediu para receber as postagens. Rode no SQL Editor do
-- Supabase depois do schema.sql (pode rodar de novo sem problema). Quem visita o site
-- só consegue se inscrever; a lista só aparece para a equipe.

create table if not exists public.inscritos (
  email text primary key check (email = lower(email) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

alter table public.inscritos enable row level security;
drop policy if exists "inscritos: leitura da equipe" on public.inscritos;
create policy "inscritos: leitura da equipe" on public.inscritos for select to authenticated using (public.is_editor());
drop policy if exists "inscritos: remoção da equipe" on public.inscritos;
create policy "inscritos: remoção da equipe" on public.inscritos for delete to authenticated using (public.is_editor());
grant select, delete on public.inscritos to authenticated;

-- Chamada pelo formulário da home. Responde igual para e-mail novo ou repetido,
-- para não revelar quem já está na lista.
create or replace function public.inscrever(p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.inscritos (email) values (lower(trim(p_email))) on conflict (email) do nothing;
$$;

revoke execute on function public.inscrever(text) from public;
grant execute on function public.inscrever(text) to anon, authenticated;

-- Ver a lista:            select email, created_at from public.inscritos order by created_at desc;
-- Descadastrar alguém:    delete from public.inscritos where email = 'email@da.pessoa';
