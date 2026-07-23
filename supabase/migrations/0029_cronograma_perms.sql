-- WS1.1 — Cronograma: permissão em 2 níveis.
--  ESTRUTURA (blocos/ordem/duração/modo ao vivo) = admin OU membro de equipe
--    marcada como gestora do cronograma (flag manages_rundown).
--  CONTEÚDO (link/observação de um bloco) = quem está escalado no evento,
--    via RPC dedicada (SECURITY DEFINER) que só toca em link/note.
-- Corrige o mismatch app(!!session) x RLS que travava a Fernanda (líder de Produção).

-- 1) Flag da equipe controladora (sem hardcode de nome no código).
alter table public.teams
  add column if not exists manages_rundown boolean not null default false;

-- Marca a equipe "Produção" como gestora do cronograma (uma igreja hoje).
update public.teams set manages_rundown = true where name = 'Produção';

-- 2) Helper: o usuário logado é membro de alguma equipe gestora de cronograma?
create or replace function public.manages_rundown()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships m
    join public.teams t on t.id = m.team_id
    where m.profile_id = auth.uid() and t.manages_rundown
  );
$$;
grant execute on function public.manages_rundown() to authenticated;

-- 3) RLS de escrita da ESTRUTURA: admin OU gestor de cronograma.
--    (Removida a regra antiga "líder de equipe escalada no evento".)
drop policy if exists rundown_write on public.event_rundown;
create policy rundown_write on public.event_rundown
  for all
  using (is_admin() or public.manages_rundown())
  with check (is_admin() or public.manages_rundown());

-- 4) CONTEÚDO: voluntário escalado adiciona link/observação a um bloco,
--    sem poder mexer na estrutura. SECURITY DEFINER, só atualiza link/note.
create or replace function public.contribuir_no_bloco(p_bloco uuid, p_link text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  select event_id into v_event from public.event_rundown where id = p_bloco;
  if v_event is null then
    raise exception 'Bloco inexistente.';
  end if;
  if not exists (
    select 1 from public.assignments a
    where a.event_id = v_event and a.profile_id = auth.uid()
  ) then
    raise exception 'Sem permissão: você não está escalado neste evento.';
  end if;
  update public.event_rundown
     set link = p_link, note = p_note
   where id = p_bloco;
end;
$$;
grant execute on function public.contribuir_no_bloco(uuid, text, text) to authenticated;
