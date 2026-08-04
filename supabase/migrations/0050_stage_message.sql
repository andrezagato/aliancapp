-- 0050 — MENSAGEM NO TELÃO (stage message do ProPresenter)
--
-- A Produção precisa falar com quem está no palco durante o culto: "falta 1
-- minuto", "fale no microfone", "volta pro palco". Hoje isso acontece por gesto
-- ou por alguém andando até lá. A ponte (ponte-propresenter/) já tem caminho
-- aberto pro ProPresenter, e o protocolo dele aceita stageDisplaySendMessage —
-- então quem escreve é o app e quem entrega é a ponte.
--
-- Três escolhas que valem registro:
--
-- 1. TABELA EM FORMA DE LOG, não uma linha mutável. Só UMA mensagem fica viva
--    por vez (enviar apaga a anterior), mas o histórico sobra de graça — e a
--    pergunta que uma tela lida pela plateia sempre gera ("quem mandou isso?")
--    passa a ter resposta. `cleared_at` é quem tirou do telão.
--
-- 2. EXPIRAÇÃO OBRIGATÓRIA. Não existe mensagem "fixa": mensagem esquecida
--    morando no telão do pregador é pior que mensagem nenhuma. Quem precisa de
--    mais tempo reenvia. O app oferece 1/3/10 min; aqui a trava é 1..60.
--
-- 3. LIMITE DE 6 ATALHOS. Acima disso a pessoa para de ACERTAR um botão e passa
--    a LER uma lista — e aí digitar já era mais rápido. 6 também é o que cabe em
--    duas fileiras de chips no celular.
--
-- Permissão: `pode_conduzir_roteiro()` (0049) — admin, ou equipe com
-- manages_rundown. A mesma turma que inicia e encerra o culto. Escrita SÓ por
-- estas funções: as tabelas não têm policy de write nenhuma.

create table if not exists public.stage_messages (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  event_id   uuid references public.events(id) on delete cascade,
  texto      text not null,
  autor_id   uuid references public.profiles(id) on delete set null,
  sent_at    timestamptz not null default now(),
  expires_at timestamptz not null,
  cleared_at timestamptz
);
create index if not exists stage_messages_vivas on public.stage_messages (church_id, sent_at desc);

create table if not exists public.stage_shortcuts (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  label      text not null,
  sort_order int not null default 0
);
create index if not exists stage_shortcuts_igreja on public.stage_shortcuts (church_id, sort_order);

alter table public.stage_messages enable row level security;
alter table public.stage_shortcuts enable row level security;

-- Leitura aberta a quem está ativo (igual eventos e roteiro): a régia, o celular
-- e a faixa de "no telão agora" precisam ver o que está no ar.
create policy stage_messages_read on public.stage_messages
  for select to authenticated using (is_active() or is_admin());
create policy stage_shortcuts_read on public.stage_shortcuts
  for select to authenticated using (is_active() or is_admin());

-- Manda pro telão. Apaga a anterior na mesma transação: uma viva por vez.
create or replace function public.enviar_stage_message(p_event uuid, p_texto text, p_minutos int default 3)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
  v_texto  text := btrim(coalesce(p_texto, ''));
  v_min    int  := least(60, greatest(1, coalesce(p_minutos, 3)));
  v_id     uuid;
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para mandar mensagem ao palco.';
  end if;
  if v_texto = '' then
    raise exception 'A mensagem está vazia.';
  end if;
  if length(v_texto) > 120 then
    raise exception 'A mensagem passa de 120 caracteres — no telão isso não se lê.';
  end if;

  select church_id into v_church from public.events where id = p_event;
  if v_church is null then
    select church_id into v_church from public.profiles where id = auth.uid();
  end if;
  if v_church is null then
    raise exception 'Não descobri a igreja desta mensagem.';
  end if;

  update public.stage_messages set cleared_at = now()
   where church_id = v_church and cleared_at is null;

  insert into public.stage_messages (church_id, event_id, texto, autor_id, expires_at)
  values (v_church, p_event, v_texto, auth.uid(), now() + make_interval(mins => v_min))
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.enviar_stage_message(uuid, text, int) to authenticated;

-- Tira do telão agora (o que estiver vivo na igreja).
create or replace function public.limpar_stage_message(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_church uuid;
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para mandar mensagem ao palco.';
  end if;
  select church_id into v_church from public.events where id = p_event;
  if v_church is null then
    select church_id into v_church from public.profiles where id = auth.uid();
  end if;
  update public.stage_messages set cleared_at = now()
   where church_id = v_church and cleared_at is null;
end;
$$;
grant execute on function public.limpar_stage_message(uuid) to authenticated;

create or replace function public.salvar_atalho_stage(p_label text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
  v_label  text := btrim(coalesce(p_label, ''));
  v_id     uuid;
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para mexer nos atalhos.';
  end if;
  if v_label = '' then
    raise exception 'O atalho está vazio.';
  end if;
  if length(v_label) > 40 then
    raise exception 'Atalho muito longo (máx. 40 caracteres).';
  end if;
  select church_id into v_church from public.profiles where id = auth.uid();
  if (select count(*) from public.stage_shortcuts where church_id = v_church) >= 6 then
    raise exception 'Limite de 6 atalhos. Apague um antes de criar outro.';
  end if;
  insert into public.stage_shortcuts (church_id, label, sort_order)
  values (v_church, v_label,
          coalesce((select max(sort_order) + 1 from public.stage_shortcuts where church_id = v_church), 0))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.salvar_atalho_stage(text) to authenticated;

create or replace function public.remover_atalho_stage(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para mexer nos atalhos.';
  end if;
  delete from public.stage_shortcuts s
   where s.id = p_id
     and s.church_id = (select church_id from public.profiles where id = auth.uid());
end;
$$;
grant execute on function public.remover_atalho_stage(uuid) to authenticated;

-- Atalhos de partida, pra estrear com a caixa cheia em vez de vazia.
insert into public.stage_shortcuts (church_id, label, sort_order)
select c.id, x.label, x.ord
  from public.churches c,
       (values ('Falta 1 minuto', 0), ('Encerrando', 1), ('Fale no microfone', 2), ('Volta pro palco', 3)) as x(label, ord)
 where not exists (select 1 from public.stage_shortcuts s where s.church_id = c.id);

-- Tempo real (0047): a faixa "no telão agora" tem que acender em TODAS as telas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stage_messages'
  ) then
    alter publication supabase_realtime add table public.stage_messages;
  end if;
end $$;
