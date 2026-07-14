-- =============================================================================
-- 0007_confirm_event — responsável confirma que o evento vai acontecer
--
-- events só é editável por admin (events_manage). Mas o RESPONSÁVEL (não-admin)
-- precisa poder marcar confirmed_at. Fazemos via RPC security definer que checa
-- responsible_id = auth.uid() (ou admin) — sem abrir o update geral de events.
-- =============================================================================

create or replace function confirmar_evento(p_event uuid, p_confirmar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_confirmar then
    update events set confirmed_at = now(), confirmed_by = auth.uid()
     where id = p_event and (responsible_id = auth.uid() or is_admin());
  else
    update events set confirmed_at = null, confirmed_by = null
     where id = p_event and (responsible_id = auth.uid() or is_admin());
  end if;
  if not found then
    raise exception 'Sem permissão ou evento não encontrado';
  end if;
end;
$$;

revoke execute on function confirmar_evento(uuid, boolean) from public;
grant execute on function confirmar_evento(uuid, boolean) to authenticated;
