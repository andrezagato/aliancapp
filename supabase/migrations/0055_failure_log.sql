-- 0055 — FAILURE LOG: parar de jogar fora o que o sistema já sabe.
--
-- O problema não é falta de detecção. É DESCARTE. Em todos os incidentes deste
-- mês a informação existia, no instante exato, com precisão — e foi perdida:
--
--   · 21/08 · a Verônica tocou no link do e-mail duas vezes e o GoTrue devolveu
--     `both auth code and code verifier should be non-empty` nas duas. O app
--     redirecionou pra /entrar e não guardou nada. Ela disse "abri o link e não
--     apareceu nada", que é a descrição fiel do que ela viu e inútil pra
--     diagnóstico. Cinco dias depois, quem achou a causa foi um SELECT nos logs
--     do Supabase — que expiram em 24h e quase não pegaram o caso;
--   · 16/08 · o e-mail de convite do Tiago pode ou não ter saído. `sendEmail` é
--     best-effort de propósito (um e-mail não pode derrubar a escalação), mas
--     best-effort virou best-forget: o catch engole e ninguém nunca soube;
--   · 31/jul–03/ago · a cobrança da escala não rodou por 3 dias. O middleware
--     sabia que estava devolvendo 307 pro cron. Silêncio.
--
-- Esta tabela é o lugar pra onde essas coisas passam a ir. Ela não detecta nada
-- novo — só para de descartar o que já era sabido.
--
-- POR QUE UMA TABELA E NÃO O LOG DA VERCEL. O log da Vercel some, não é
-- consultável por data, e ninguém abre. O digest diário (0055 + /api/cron/digest)
-- precisa fazer PERGUNTAS a isso — "quantos logins falharam ontem, e por quê" —
-- e log de plataforma não responde pergunta.
--
-- SEM POLÍTICA DE INSERT, DE PROPÓSITO. Só o service-role escreve (helper
-- `registrarFalha`, server-only). Uma política de insert pra `authenticated`
-- deixaria qualquer pessoa logada encher a tabela — e a maior parte destes
-- registros nasce em rota SEM sessão (quem falhou no login não está logado),
-- então a política nem ajudaria.
--
-- CONTÉM E-MAIL DE PESSOA. Por isso a leitura é só de admin. `subject` guarda de
-- quem é a falha justamente pra que o digest possa dizer "a Verônica não
-- conseguiu entrar" em vez de "houve 2 falhas" — que é a diferença entre um
-- aviso acionável e um número.

do $$ begin
  create type public.failure_kind as enum (
    'login_link',    -- magic link / callback: a sessão não abriu
    'convite_link',  -- /auth/entrar/[token]: o convite foi recusado
    'email',         -- o Resend recusou ou explodiu
    'cron'           -- uma rota de cron falhou
  );
exception when duplicate_object then null; end $$;

create table if not exists public.failure_log (
  id         uuid primary key default gen_random_uuid(),
  kind       public.failure_kind not null,
  -- A mensagem CRUA do serviço, sem tradução. "both auth code and code verifier
  -- should be non-empty" é o que permitiu achar o PKCE; "não consegui entrar"
  -- não teria permitido nada.
  detail     text not null,
  -- De quem é a falha: e-mail, quando se sabe. Nulo é normal — um convite
  -- recusado por token inválido não tem dono conhecido.
  subject    text,
  -- Onde aconteceu, pra separar /auth/confirm de /auth/callback sem parsear
  -- `detail`. São bugs diferentes com sintoma idêntico.
  origem     text,
  created_at timestamptz not null default now()
);

-- O digest pergunta sempre a mesma coisa: "o que falhou desde ontem, por tipo".
create index if not exists failure_log_recente
  on public.failure_log (created_at desc, kind);

alter table public.failure_log enable row level security;

-- Leitura só de admin. Sem policy de insert/update/delete: o service-role passa
-- por cima da RLS e é o único caminho de escrita.
drop policy if exists failure_log_read_admin on public.failure_log;
create policy failure_log_read_admin
  on public.failure_log for select to authenticated
  using (is_admin());
