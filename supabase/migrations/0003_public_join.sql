-- =============================================================================
-- 0003_public_join — auto-cadastro público (porta 2) sem vazar a igreja
--
-- Problema: o formulário /cadastro é ANÔNIMO e join_requests.church_id é NOT NULL,
-- mas o anon não pode ler `churches` (RLS). Resolvemos com uma RPC security definer
-- que resolve a igreja (single-church no MVP) e insere a solicitação.
-- =============================================================================

create or replace function solicitar_entrada(
  p_full_name text,
  p_email     text,
  p_phone     text,
  p_message   text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'Informe seu nome';
  end if;

  select id into cid from churches order by created_at limit 1;  -- MVP: uma igreja
  if cid is null then
    raise exception 'Nenhuma igreja configurada ainda';
  end if;

  insert into join_requests (church_id, full_name, email, phone, message)
  values (cid, btrim(p_full_name), nullif(btrim(p_email), ''),
          nullif(btrim(p_phone), ''), nullif(btrim(p_message), ''));
end;
$$;

grant execute on function solicitar_entrada(text, text, text, text) to anon, authenticated;
