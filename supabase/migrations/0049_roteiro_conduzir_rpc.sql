-- 0049 — INICIAR / ENCERRAR / REINICIAR O ROTEIRO VIA RPC
--
-- O bug: a Fernanda (líder da Produção, `system_role = member`) apertava
-- "Iniciar" e NADA acontecia — sem erro, sem aviso. Os tiques de bloco dela
-- salvavam normalmente, então parecia problema de tela.
--
-- A causa é uma assimetria de RLS entre as duas tabelas do roteiro:
--   · event_rundown  → `rundown_write` (0029) = is_admin() OU manages_rundown()
--   · events         → `events_manage` (0001) = SÓ is_admin()
-- O app libera as duas pela mesma porta (`podeEditarCronograma` = admin ou
-- equipe com manages_rundown), mas `iniciarCronograma` escreve em `events`.
-- O UPDATE dela casava com ZERO linhas — e um update de zero linhas NÃO é erro:
-- o PostgREST devolve 204, `error` vem null, e a action retornava sucesso.
-- Falha 100% silenciosa, a mesma família do bug corrigido na 0029.
--
-- Por que RPC e não uma política de UPDATE em `events`: uma política daria à
-- Produção poder de reescrever QUALQUER coluna do evento — título, data,
-- church_id — por chamada crua de API. RLS não restringe coluna. Estas três
-- funções tocam só as colunas do modo ao vivo, e é o padrão que o projeto já
-- usa (contribuir_no_bloco, definir_pasta_evento, marcar_editando_bloco).
--
-- De brinde, duas correções de comportamento:
--   · elas RECLAMAM quando negam (raise), em vez de mentir sucesso;
--   · iniciar/encerrar são IDEMPOTENTES. Antes, um segundo toque em "Iniciar"
--     reescrevia a âncora com now() e deslocava a hora projetada de todos os
--     blocos. Agora o primeiro carimbo é o que vale; quem quer zerar usa
--     reiniciar_roteiro.

-- Quem conduz: espelha `podeEditarCronograma` do app (admin ou equipe com a
-- flag manages_rundown). Reaproveita o helper criado na 0029.
create or replace function public.pode_conduzir_roteiro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.manages_rundown();
$$;
grant execute on function public.pode_conduzir_roteiro() to authenticated;

-- Marca o START real do culto (âncora que desloca todos os horários).
create or replace function public.iniciar_roteiro(p_event uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_inicio timestamptz;
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para conduzir o roteiro.';
  end if;
  select rundown_started_at into v_inicio from public.events where id = p_event for update;
  if not found then
    raise exception 'Culto inexistente.';
  end if;
  if v_inicio is null then
    update public.events set rundown_started_at = now() where id = p_event
      returning rundown_started_at into v_inicio;
  end if;
  return v_inicio;
end;
$$;
grant execute on function public.iniciar_roteiro(uuid) to authenticated;

-- Encerra o culto agora — congela o relógio do modo ao vivo.
create or replace function public.encerrar_roteiro(p_event uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_fim timestamptz;
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para conduzir o roteiro.';
  end if;
  select rundown_ended_at into v_fim from public.events where id = p_event for update;
  if not found then
    raise exception 'Culto inexistente.';
  end if;
  if v_fim is null then
    update public.events set rundown_ended_at = now() where id = p_event
      returning rundown_ended_at into v_fim;
  end if;
  return v_fim;
end;
$$;
grant execute on function public.encerrar_roteiro(uuid) to authenticated;

-- Zera o modo ao vivo: o start, o encerramento e todos os tiques. As duas
-- escritas ficam na mesma função de propósito — antes eram dois UPDATEs
-- separados na action, e falhar no meio deixava o culto "iniciado sem tiques".
create or replace function public.reiniciar_roteiro(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para conduzir o roteiro.';
  end if;
  update public.events set rundown_started_at = null, rundown_ended_at = null where id = p_event;
  if not found then
    raise exception 'Culto inexistente.';
  end if;
  update public.event_rundown set done_at = null where event_id = p_event;
end;
$$;
grant execute on function public.reiniciar_roteiro(uuid) to authenticated;
