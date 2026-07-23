-- WS1.2 Fase 1 — setar a pasta de arquivos do evento.
-- A RLS de events só deixa admin dar UPDATE; esta RPC (SECURITY DEFINER) permite
-- admin OU equipe gestora do cronograma (manages_rundown) atualizar SÓ files_url.
create or replace function public.definir_pasta_evento(p_event uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or public.manages_rundown()) then
    raise exception 'Sem permissão para definir a pasta do evento.';
  end if;
  update public.events set files_url = nullif(p_url, '') where id = p_event;
end;
$$;
grant execute on function public.definir_pasta_evento(uuid, text) to authenticated;
