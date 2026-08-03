-- =============================================================================
-- 0048 — VERSÃO E TRAVA MACIA DO BLOCO DO ROTEIRO
--
-- O problema real (achado em 02/ago, confirmado em 03/ago): `contribuir_no_bloco`
-- fazia `update event_rundown set link = ..., note = ...` sem olhar o que havia
-- antes. Duas pessoas anotando no mesmo bloco — Áudio e Vídeo, por exemplo — e a
-- última a salvar APAGA a observação da primeira, sem aviso pra ninguém. Perda
-- silenciosa é a pior espécie: some e não deixa rastro.
--
-- Duas camadas, de propósito:
--
--  1. GARANTIA (`content_updated_at`): quem salva manda a versão que leu. Se o
--     conteúdo mudou no meio, o salvamento é RECUSADO em vez de sobrescrever. É
--     isto que torna a perda impossível — não a trava.
--
--  2. AVISO (`editing_by`/`editing_at`): apertar "Editar" marca quem está com o
--     bloco na mão, e como `event_rundown` já está na publicação de realtime
--     (0047) isso aparece na tela dos outros em ~1s. Serve pra descobrir ANTES
--     de digitar, não pra impedir.
--
-- Por que a trava é MACIA: um culto ao vivo não pode ficar refém de um bloqueio.
-- Se o celular de quem apertou "Editar" morre, uma trava dura deixaria a Produção
-- sem poder corrigir o roteiro no meio do culto — pior que o bug que ela evita.
-- Então ela expira (a UI trata 2 min como livre) e sempre pode ser assumida.
--
-- Por que `content_updated_at` e não um `updated_at` genérico: ticar bloco
-- (`done_at`), reordenar (`sort_order`) e marcar "estou editando" acontecem TODA
-- HORA durante o culto. Se qualquer um deles mexesse na versão, o modal de quem
-- está digitando seria invalidado a cada tique — recusa espúria, e a pessoa
-- aprenderia a ignorar o aviso. Só CONTEÚDO conta como conflito.
-- =============================================================================

alter table public.event_rundown
  add column if not exists content_updated_at timestamptz not null default now(),
  add column if not exists content_updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists editing_by uuid references public.profiles(id) on delete set null,
  add column if not exists editing_at timestamptz;

comment on column public.event_rundown.content_updated_at is
  'Versão do CONTEÚDO do bloco. Tique e reordenação não mexem aqui de propósito.';
comment on column public.event_rundown.editing_by is
  'Quem apertou "Editar" (aviso, não bloqueio). Expira: a UI trata 2 min como livre.';

-- -----------------------------------------------------------------------------
-- contribuir_no_bloco — agora com checagem de versão.
-- A assinatura muda, então a antiga tem de sair: manter as duas deixaria a
-- chamada de 3 argumentos ambígua pro Postgres.
-- -----------------------------------------------------------------------------
drop function if exists public.contribuir_no_bloco(uuid, text, text);

create or replace function public.contribuir_no_bloco(
  p_bloco uuid,
  p_link text,
  p_note text,
  p_versao timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
  v_versao timestamptz;
  v_autor uuid;
  v_nome text;
begin
  select event_id, content_updated_at, content_updated_by
    into v_event, v_versao, v_autor
    from public.event_rundown where id = p_bloco;
  if v_event is null then
    raise exception 'Bloco inexistente.';
  end if;
  if not exists (
    select 1 from public.assignments a
    where a.event_id = v_event and a.profile_id = auth.uid()
  ) then
    raise exception 'Sem permissão: você não está escalado neste evento.';
  end if;

  -- `p_versao` nulo = cliente antigo, que não sabe de versão. Deixa passar em vez
  -- de travar quem está com uma aba aberta desde antes deste deploy.
  if p_versao is not null and v_versao is not null and v_versao <> p_versao then
    select coalesce(nullif(pr.nickname, ''), pr.full_name, 'outra pessoa')
      into v_nome from public.profiles pr where pr.id = v_autor;
    raise exception 'ALTERADO_POR:%', coalesce(v_nome, 'outra pessoa');
  end if;

  update public.event_rundown
     set link = p_link,
         note = p_note,
         content_updated_at = now(),
         content_updated_by = auth.uid(),
         -- salvou, então soltou: não deixa a própria marca de "editando" pra trás
         editing_by = null,
         editing_at = null
   where id = p_bloco;
end;
$$;

grant execute on function public.contribuir_no_bloco(uuid, text, text, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- marcar_editando_bloco — o aviso "estou com este bloco na mão".
-- Security definer porque quem contribui (escalado que não é gestor) não tem
-- UPDATE pela RLS `rundown_write` (0029), e ainda assim precisa avisar.
-- -----------------------------------------------------------------------------
create or replace function public.marcar_editando_bloco(p_bloco uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
  v_pode boolean;
begin
  select event_id into v_event from public.event_rundown where id = p_bloco;
  if v_event is null then
    raise exception 'Bloco inexistente.';
  end if;

  -- Mesmo universo de quem pode escrever no bloco por algum caminho: escalado no
  -- evento (contribui) OU admin/equipe gestora (edita a estrutura).
  select
    exists (
      select 1 from public.assignments a
      where a.event_id = v_event and a.profile_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_role = 'admin')
    or exists (
      select 1 from public.memberships m
      join public.teams t on t.id = m.team_id
      where m.profile_id = auth.uid() and t.manages_rundown
    )
  into v_pode;
  if not v_pode then
    raise exception 'Sem permissão neste bloco.';
  end if;

  if p_on then
    -- Assume sempre, inclusive de outra pessoa: a UI já avisou quem estava lá e
    -- pediu confirmação. Trava que não se pode assumir vira roteiro travado.
    update public.event_rundown
       set editing_by = auth.uid(), editing_at = now()
     where id = p_bloco;
  else
    -- Só solta a PRÓPRIA marca — senão fechar um modal apagaria o aviso de quem
    -- assumiu depois.
    update public.event_rundown
       set editing_by = null, editing_at = null
     where id = p_bloco and editing_by = auth.uid();
  end if;
end;
$$;

grant execute on function public.marcar_editando_bloco(uuid, boolean) to authenticated;
