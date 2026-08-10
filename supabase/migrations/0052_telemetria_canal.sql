-- 0052 — TELEMETRIA DE CANAL: quem foi alcançado, por onde, e o que respondeu.
--
-- O problema: hoje é impossível responder "o push funciona?". O envio é
-- best-effort por desenho (`sendPushToSubs` engole todo erro num catch vazio) e
-- o único registro que existe, `reminder_log` (0045), grava a INTENÇÃO de cobrar
-- — nunca o resultado. Então uma pessoa sem inscrição, uma inscrição expirada e
-- um push entregue e ignorado são, no banco, exatamente a mesma coisa: nada.
--
-- Isso vai virar problema grande quando o WhatsApp entrar. Sem linha de base,
-- ninguém consegue distinguir "o WhatsApp trouxe resposta nova" de "o WhatsApp
-- canibalizou quem já respondia pelo app" — e a decisão de manter ou não um
-- canal pago viraria questão de sensação. Medir ANTES é o que torna a
-- comparação honesta.
--
-- O levantamento de 10/ago, que motivou esta migration (44 pessoas ativas):
--   · 17 com push (39%), 22 com telefone (50%), 18 SEM canal nenhum (41%);
--   · o WhatsApp adiciona só 9 pessoas que o push não alcança;
--   · dos 10 escalados que nunca responderam, 6 JÁ TÊM push instalado — pra
--     maioria dos silenciosos o canal não é o gargalo;
--   · mediana pra confirmar 8,3h; pra recusar 91,5h. Dizer "não vou poder"
--     custa 11× mais que dizer "vou", e isso é atrito de formulário, não moral.
--
-- Três coisas nascem aqui: o log do ENVIO (delivery_log), a atribuição da
-- RESPOSTA (assignments.responded_via / first_seen_at) e o consentimento de
-- WhatsApp (profiles.whatsapp_opt_in_at), que a Meta exige antes do primeiro
-- template e que não dá pra coletar retroativamente.

-- ---------------------------------------------------------------------------
-- 1) Vocabulário
-- ---------------------------------------------------------------------------

-- 'whatsapp' já entra no enum mesmo sem implementação: o dia em que o canal
-- subir, ele grava no mesmo lugar e a série histórica fica comparável.
do $$ begin
  create type public.delivery_channel as enum ('push', 'whatsapp', 'email', 'in_app');
exception when duplicate_object then null; end $$;

-- A distinção que interessa não é "deu certo / deu errado", é POR QUE não saiu:
--   · enviado     → o serviço aceitou (não prova leitura, prova saída)
--   · falhou      → tentou e o serviço recusou (inscrição morta, 5xx, timeout)
--   · sem_destino → a pessoa não tem endereço nesse canal (sem push, sem fone)
--   · desligado   → tem endereço, mas desligou o assunto em notification_prefs
-- Sem essa separação, "não alcançamos 20 pessoas" não diz se o remédio é
-- cadastro, suporte técnico ou respeitar a escolha de quem pediu silêncio.
do $$ begin
  create type public.delivery_outcome as enum ('enviado', 'falhou', 'sem_destino', 'desligado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) O log de entrega
-- ---------------------------------------------------------------------------

create table if not exists public.delivery_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  channel public.delivery_channel not null,
  outcome public.delivery_outcome not null,
  -- reusa o enum dos avisos: sem vocabulário novo, e dá pra cruzar com
  -- `notifications` e `notification_prefs` sem tradução no meio.
  kind public.notification_kind not null,
  event_id uuid references public.events (id) on delete set null,
  assignment_id uuid references public.assignments (id) on delete set null,
  -- só existe pra RLS: é o que deixa o líder ver o alcance da PRÓPRIA equipe
  -- sem ver o da igreja inteira. Aviso sem equipe (cadastro, conquista) fica
  -- visível só pro admin, e está certo assim.
  team_id uuid references public.teams (id) on delete set null,
  -- Identificador do lado do provedor, pra rastrear um caso concreto: no
  -- WhatsApp é o wamid; no push é um HASH CURTO do endpoint, nunca o endpoint
  -- cru — o endpoint é a capacidade de enviar push pra aquele aparelho, e esta
  -- tabela é lida por líderes, ao contrário de `push_subscriptions`.
  provider_id text,
  detail text,
  sent_at timestamptz not null default now()
);

create index if not exists delivery_log_sent_idx on public.delivery_log (sent_at desc);
create index if not exists delivery_log_profile_idx on public.delivery_log (profile_id, sent_at desc);
create index if not exists delivery_log_assignment_idx on public.delivery_log (assignment_id)
  where assignment_id is not null;

alter table public.delivery_log enable row level security;

-- Ninguém escreve por política: quem grava é `registrar_entrega` (security
-- definer) ou o cron com service-role. Leitura é de quem pode AGIR com o dado.
drop policy if exists "delivery_log_gestor_read" on public.delivery_log;
create policy "delivery_log_gestor_read"
  on public.delivery_log for select
  using (public.is_admin() or (team_id is not null and public.is_team_leader(team_id)));

-- ---------------------------------------------------------------------------
-- 3) Atribuição da resposta
-- ---------------------------------------------------------------------------

alter table public.assignments
  -- por qual canal a pessoa chegou pra responder. Null = não atribuído (todas
  -- as respostas anteriores a esta migration, e quem entrou digitando a URL).
  add column if not exists responded_via public.delivery_channel,
  -- quando a pessoa VIU a escalação. Separa "o aviso não chegou" de "chegou e
  -- ela demorou pra decidir" — que é a pergunta real dos 6 silenciosos que já
  -- têm push instalado.
  add column if not exists first_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4) Consentimento de WhatsApp
-- ---------------------------------------------------------------------------

-- Um timestamptz, não um boolean: a Meta exige opt-in demonstrável e a LGPD
-- pede QUANDO foi dado. Null = sem consentimento (o padrão, inclusive pra quem
-- já tem telefone cadastrado — telefone não é permissão).
alter table public.profiles
  add column if not exists whatsapp_opt_in_at timestamptz;

-- ---------------------------------------------------------------------------
-- 5) Gravação
-- ---------------------------------------------------------------------------

-- Security definer porque quem registra a entrega é o REMETENTE, e o remetente
-- é outra pessoa: `notify()` roda com a sessão de quem escalou, não de quem
-- recebe. Sem isso a linha nunca nasceria — e nasceria calada, que é o modo de
-- falhar desta casa (0029, 0049).
create or replace function public.registrar_entrega(
  p_profile uuid,
  p_channel public.delivery_channel,
  p_outcome public.delivery_outcome,
  p_kind public.notification_kind,
  p_event uuid default null,
  p_assignment uuid default null,
  p_team uuid default null,
  p_provider_id text default null,
  p_detail text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- `auth.uid() is null` = contexto de servidor confiável (o cron da cobrança
  -- roda com service-role e não tem sessão). Sem essa ressalva a função daria
  -- raise dentro do cron e derrubaria a única tarefa agendada do Sirvo. `anon`
  -- não passa por aqui: o grant abaixo é só pra `authenticated`.
  if auth.uid() is not null and not public.is_active() then
    raise exception 'Sem permissão para registrar entrega.';
  end if;
  insert into public.delivery_log
    (profile_id, channel, outcome, kind, event_id, assignment_id, team_id, provider_id, detail)
  values
    (p_profile, p_channel, p_outcome, p_kind, p_event, p_assignment, p_team, p_provider_id, p_detail);
end; $$;
grant execute on function public.registrar_entrega(
  uuid, public.delivery_channel, public.delivery_outcome, public.notification_kind,
  uuid, uuid, uuid, text, text
) to authenticated;

-- Carimba que a pessoa VIU a escalação. Idempotente: o primeiro olhar é o que
-- vale, senão cada refresh empurraria o carimbo e "tempo até ver" viraria zero.
create or replace function public.marcar_visto(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.assignments
     set first_seen_at = coalesce(first_seen_at, now())
   where id = p_assignment
     and profile_id = auth.uid();
end; $$;
grant execute on function public.marcar_visto(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) As RPCs de resposta passam a carregar o canal
-- ---------------------------------------------------------------------------

-- Por que aqui dentro e não num update na action: a RLS de `assignments` só dá
-- UPDATE a `is_admin() or is_team_leader(team_id)`. Um voluntário gravando
-- `responded_via` por update direto casaria com ZERO linhas, o PostgREST
-- devolveria 204, `error` viria null — e a telemetria inteira nasceria vazia
-- sem uma única mensagem de erro. É exatamente a armadilha da 0029 e da 0049.
--
-- DROP + CREATE em vez de overload com default: as duas versões conviveriam e
-- a chamada de um argumento ficaria ambígua ("function is not unique"). Só há
-- dois chamadores, os dois em src/lib/actions.ts, e os dois passam por nome —
-- então `{ p_assignment }` continua resolvendo pro parâmetro com default.

drop function if exists public.confirmar_escalacao(uuid);
create function public.confirmar_escalacao(
  p_assignment uuid,
  p_via public.delivery_channel default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  update assignments
     set status = 'confirmado',
         responded_at = now(),
         -- coalesce e não sobrescrita: se o canal não veio (link digitado à
         -- mão), preserva o que já estava lá em vez de apagar atribuição boa.
         responded_via = coalesce(p_via, responded_via)
   where id = p_assignment
     and profile_id = auth.uid()
     and status = 'convidado';
  if not found then
    raise exception 'Escalação não encontrada ou não pode ser confirmada';
  end if;
end; $$;
grant execute on function public.confirmar_escalacao(uuid, public.delivery_channel) to authenticated;

drop function if exists public.recusar_escalacao(uuid, text);
create function public.recusar_escalacao(
  p_assignment uuid,
  p_motivo text,
  p_via public.delivery_channel default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  update assignments
     set status = 'recusado',
         decline_reason = p_motivo,
         responded_at = now(),
         responded_via = coalesce(p_via, responded_via)
   where id = p_assignment
     and profile_id = auth.uid()
     and status in ('convidado', 'confirmado');
  if not found then
    raise exception 'Escalação não encontrada ou não pode ser recusada';
  end if;
end; $$;
grant execute on function public.recusar_escalacao(uuid, text, public.delivery_channel) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Leitura pro painel
-- ---------------------------------------------------------------------------

-- ALCANCE — uma linha por pessoa: tem push? tem telefone? liberou o WhatsApp?
-- É o que mostra os 41% sem canal nenhum, que hoje são invisíveis. Admin vê a
-- igreja; líder vê só quem está nas equipes que ele lidera.
create or replace function public.canais_alcance()
returns table (
  profile_id uuid,
  nome text,
  tem_push boolean,
  tem_telefone boolean,
  zap_liberado boolean
) language plpgsql security definer set search_path = public as $$
declare v_church uuid;
begin
  if not (public.is_admin() or public.is_any_leader()) then
    raise exception 'Sem permissão para ver o alcance dos canais.';
  end if;
  select church_id into v_church from public.profiles where id = auth.uid();
  return query
    select p.id,
           coalesce(nullif(btrim(p.nickname), ''), p.full_name, 'Sem nome'),
           exists (select 1 from public.push_subscriptions s where s.profile_id = p.id),
           -- 10 dígitos = DDD + número. Telefone curto/incompleto no cadastro
           -- não conta como alcance: contaria como promessa falsa no painel.
           length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 10,
           p.whatsapp_opt_in_at is not null
      from public.profiles p
     where p.church_id = v_church
       and p.status = 'ativo'
       and (
         public.is_admin()
         or exists (
           select 1 from public.memberships m
            where m.profile_id = p.id and public.is_team_leader(m.team_id)
         )
       );
end; $$;
grant execute on function public.canais_alcance() to authenticated;

-- EFICÁCIA — uma linha por canal. Junta os dois lados: o que SAIU
-- (delivery_log) e o que VOLTOU (assignments.responded_via).
create or replace function public.canais_eficacia(p_dias int default 90)
returns table (
  canal public.delivery_channel,
  enviados bigint,
  falhou bigint,
  sem_destino bigint,
  desligado bigint,
  respostas bigint,
  horas_mediana numeric,
  compareceram bigint
) language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
  v_desde timestamptz;
begin
  if not (public.is_admin() or public.is_any_leader()) then
    raise exception 'Sem permissão para ver a eficácia dos canais.';
  end if;
  select church_id into v_church from public.profiles where id = auth.uid();
  v_desde := now() - make_interval(days => p_dias);
  return query
    with canais as (
      select unnest(enum_range(null::public.delivery_channel)) as canal
    ),
    saiu as (
      select dl.channel,
             count(*) filter (where dl.outcome = 'enviado')     as enviados,
             count(*) filter (where dl.outcome = 'falhou')       as falhou,
             count(*) filter (where dl.outcome = 'sem_destino')  as sem_destino,
             count(*) filter (where dl.outcome = 'desligado')    as desligado
        from public.delivery_log dl
        join public.profiles p on p.id = dl.profile_id
       where dl.sent_at >= v_desde
         and p.church_id = v_church
       group by dl.channel
    ),
    voltou as (
      select a.responded_via as channel,
             count(*) as respostas,
             percentile_cont(0.5) within group (
               order by extract(epoch from (a.responded_at - a.created_at)) / 3600
             ) as horas,
             -- ATENÇÃO ao ler: 'presente' depende de alguém fazer check-in, e o
             -- check-in é pouco usado (3 de 55 em 10/ago). Enquanto isso não
             -- mudar, "confirmou e não veio" NÃO é mensurável — a ausência de
             -- 'presente' significa "ninguém marcou", não "a pessoa faltou".
             count(*) filter (where a.status = 'presente') as compareceram
        from public.assignments a
        join public.profiles p on p.id = a.profile_id
       where a.responded_via is not null
         and a.responded_at is not null
         and a.responded_at >= v_desde
         and p.church_id = v_church
       group by a.responded_via
    )
    select c.canal,
           coalesce(s.enviados, 0),
           coalesce(s.falhou, 0),
           coalesce(s.sem_destino, 0),
           coalesce(s.desligado, 0),
           coalesce(v.respostas, 0),
           round(v.horas::numeric, 1),
           coalesce(v.compareceram, 0)
      from canais c
      left join saiu s on s.channel = c.canal
      left join voltou v on v.channel = c.canal
     order by c.canal;
end; $$;
grant execute on function public.canais_eficacia(int) to authenticated;

-- RESUMO — os escalares do topo do painel, incluindo o número que impede
-- autoengano: quantas respostas ficaram SEM atribuição de canal. Enquanto
-- `sem_atribuicao` for alto, qualquer comparação entre canais é chute.
create or replace function public.canais_resumo(p_dias int default 90)
returns table (
  escalados bigint,
  respondidos bigint,
  pendentes bigint,
  atribuidos bigint,
  sem_atribuicao bigint,
  horas_ate_confirmar numeric,
  horas_ate_recusar numeric
) language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
  v_desde timestamptz;
begin
  if not (public.is_admin() or public.is_any_leader()) then
    raise exception 'Sem permissão para ver o resumo dos canais.';
  end if;
  select church_id into v_church from public.profiles where id = auth.uid();
  v_desde := now() - make_interval(days => p_dias);
  return query
    select count(*),
           count(a.responded_at),
           count(*) filter (where a.status = 'convidado'),
           count(a.responded_via),
           count(*) filter (where a.responded_at is not null and a.responded_via is null),
           round((percentile_cont(0.5) within group (
             order by case when a.status in ('confirmado', 'presente')
                      then extract(epoch from (a.responded_at - a.created_at)) / 3600 end
           ))::numeric, 1),
           round((percentile_cont(0.5) within group (
             order by case when a.status = 'recusado'
                      then extract(epoch from (a.responded_at - a.created_at)) / 3600 end
           ))::numeric, 1)
      from public.assignments a
      join public.profiles p on p.id = a.profile_id
     where a.created_at >= v_desde
       and p.church_id = v_church;
end; $$;
grant execute on function public.canais_resumo(int) to authenticated;
