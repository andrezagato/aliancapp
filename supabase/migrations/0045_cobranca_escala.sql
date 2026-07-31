-- 0045 — registro da cobrança automática de escala (a primeira tarefa AGENDADA
-- do Sirvo; até aqui todo aviso nascia de alguém tocando algo no app).
--
-- Regra combinada: quem foi escalado e não respondeu é cobrado em ESCALADA
-- (D-3, D-2, D-1 e no dia), parando na primeira resposta — sim ou não. Líder da
-- equipe e responsável do culto recebem um resumo diário do que está pendente,
-- porque são os únicos que podem agir (ligar, trocar, cobrir).
--
-- Esta tabela é o que impede a cobrança em dobro: a `unique` abaixo é o
-- travamento. O cron INSERE primeiro e só envia se o insert criou a linha — se
-- ele rodar duas vezes (retry da Vercel, disparo manual), a segunda não envia.
-- De quebra, é o histórico pra medir se cobrar funciona (WS2.3).

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  -- 'escala_pendente' (cobra quem não respondeu) | 'digest_gestor' (resumo)
  kind text not null,
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- dias de calendário até o evento quando o aviso saiu (3, 2, 1, 0). Também é
  -- o que garante "no máximo um por dia": no dia seguinte o degrau muda.
  step smallint not null,
  sent_at timestamptz not null default now(),
  unique (kind, event_id, profile_id, step)
);

create index if not exists reminder_log_event_idx on public.reminder_log (event_id);

alter table public.reminder_log enable row level security;

-- Ninguém escreve por aqui: quem grava é o cron, com service-role (ignora RLS).
-- Admin pode LER pra investigar "essa pessoa foi cobrada?" e pras métricas.
drop policy if exists "reminder_log_admin_read" on public.reminder_log;
create policy "reminder_log_admin_read"
  on public.reminder_log for select
  using (public.is_admin());
