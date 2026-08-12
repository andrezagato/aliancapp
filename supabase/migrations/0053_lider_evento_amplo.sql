-- =============================================================================
-- 0053 — Líder é quase admin pra EVENTO: vê e escreve no chat de qualquer culto
-- =============================================================================
-- Duas coisas erradas achadas em auditoria (11/ago):
--
-- 1) A 0037 deixava o líder ler/escrever no chat de um evento só se a EQUIPE
--    dele tivesse requisito naquele evento específico. Decisão de hoje: líder
--    vê e escreve em QUALQUER evento, igual admin — não precisa mais ter
--    requisito ali. (`can_read_channel` já tinha essa regra estreita;
--    `can_post_channel` nem isso, ver item 2.)
--
-- 2) A 0038 ("Avisos gerais vira mural só do admin") reescreveu a função
--    `can_post_channel` inteira pra mudar só o caso 'avisos' — e no processo
--    perdeu, sem querer, a cláusula de líder-com-requisito que a 0037 tinha
--    posto no caso 'evento', e ganhou (também sem o comentário mencionar) um
--    bypass de admin que a 0037 não tinha. Resultado: um líder que lidera uma
--    equipe ESCALADA no evento não conseguia postar no chat dele — só quem
--    estava pessoalmente escalado ou era admin.
--
-- `chat_push_recipients` (quem recebe push) fica como está: só quem está
-- escalado ou lidera equipe com requisito no evento. Abrir a permissão de
-- ler/escrever pra todo líder não deveria virar push de todo evento pra todo
-- líder da igreja — isso é ruído, não o que foi pedido.

create or replace function public.can_read_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_active() and p_ref = (select church_id from public.profiles where id = auth.uid())
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then
      public.is_admin()
      or public.is_any_leader()
      or exists (select 1 from public.assignments a
                   where a.event_id = p_ref and a.profile_id = auth.uid())
    else false end;
$$;

create or replace function public.can_post_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_admin()
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then
      public.is_admin()
      or public.is_any_leader()
      or exists (select 1 from public.assignments a
                   where a.event_id = p_ref and a.profile_id = auth.uid())
    else false end;
$$;

grant execute on function public.can_read_channel(text, uuid) to authenticated;
grant execute on function public.can_post_channel(text, uuid) to authenticated;
