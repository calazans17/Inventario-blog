-- Opcional: atualiza o site na hora em que alguém salva na Redação.
-- Sem isto o site também atualiza, mas pelo agendamento do workflow (de hora em hora).
--
-- 1. Gere um token em github.com/settings/personal-access-tokens/new
--    Repository access: só calazans17/Inventario-blog. Permissions → Contents: Read and write.
-- 2. Troque COLE_O_TOKEN_AQUI abaixo e rode no SQL Editor do Supabase.
--    O token fica guardado no Vault do Supabase, fora do site e do repositório.

create extension if not exists pg_net with schema extensions;

select vault.create_secret('COLE_O_TOKEN_AQUI', 'github_token', 'Dispara o deploy do site no GitHub Actions');

create or replace function public.disparar_deploy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://api.github.com/repos/calazans17/Inventario-blog/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_token'),
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'somos-inventario'
    ),
    body := jsonb_build_object('event_type', 'publicar')
  );
  return null;
end;
$$;

drop trigger if exists posts_deploy on public.posts;
create trigger posts_deploy after insert or update or delete on public.posts
for each statement execute function public.disparar_deploy();

-- Trocar o token depois: select vault.update_secret((select id from vault.secrets where name = 'github_token'), 'NOVO_TOKEN');
