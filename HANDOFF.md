# HANDOFF — Aliança / Servir (PWA de escalas de igreja)

> Documento de continuação. Leia junto com **[PLAN.md](PLAN.md)** (fonte da verdade).
> Abra a sessão a partir de `C:\Users\andre.zagato\Documents\ProjetosPessoais` (pasta-pai,
> onde vive o `.mcp.json` do Supabase) — só assim as ferramentas `mcp__supabase__*` carregam.

## Estado atual — Fase 1 CONCLUÍDA ✅

O núcleo **escalar → confirmar/cancelar** está implementado e ligado ao Supabase cloud.
Build, typecheck e lint passam limpos; middleware/auth gate e telas públicas verificados
rodando (`npm run dev`). Falta só o **Google OAuth** (passo manual do André, abaixo) pra
testar os fluxos logados de ponta a ponta.

**Banco (projeto `acwpsnfvliidyxtjevfv`):**
- `0001_init.sql` aplicado (schema + RLS + triggers + view + RPCs).
- `0002_hardening` · `0003_public_join` · `0004_lock_functions` aplicados e versionados em
  `supabase/migrations/` **e** rastreados em `list_migrations` (o 0001 foi aplicado
  out-of-band, então não aparece no tracking — se for usar `supabase db push`, rode antes
  `supabase migration repair --status applied 0001`).
- **Seed cloud** rodado (`supabase/seed_cloud.sql`): igreja "Igreja do André" (join_code
  `ALIANCA`), **convite de admin** para `andrezagato@gmail.com`, 5 equipes + posições,
  série "Culto de Domingo" e **1 culto no próximo domingo 18h** com 9 vagas em aberto.
- Advisors de segurança: só sobraram os WARNs **intencionais** (auto-cadastro anon +
  `rls_auto_enable` gerenciado pelo Supabase + funções `SECURITY DEFINER` que o
  `authenticated` precisa chamar pela RLS).
- `.env.local` preenchido (URL + anon key).
- `database.types.ts` regenerado do schema real.

**Código (Fase 1):** `lib/auth.ts` (sessão + papel), `lib/data.ts` (queries), `lib/actions.ts`
(server actions), `lib/coverage.ts`, `lib/format.ts`. Telas: login (só Google), `/aguardando`
(fila de aprovação), home por papel (`/inicio`), escalas (`/escalas`, `/escalas/[id]`,
`/escalas/novo`), pessoas (`/pessoas`: convites + aprovações). `lib/demo.ts` removido.

## PASSO MANUAL PENDENTE (bloqueia o teste logado)

1. **Google OAuth** — no [Google Cloud Console](https://console.cloud.google.com/) criar
   credenciais OAuth (Web). Redirect autorizado:
   `https://acwpsnfvliidyxtjevfv.supabase.co/auth/v1/callback`.
   Colar Client ID/Secret em Supabase → **Authentication → Providers → Google**.
   Em **Authentication → URL Configuration**: Site URL `http://localhost:3000` e
   Redirect URLs `http://localhost:3000/**`.
2. **Confirme o email do admin.** O convite foi criado com `andrezagato@gmail.com`. Se você
   for logar com OUTRO Google (ex.: o corporativo), troque antes:
   `update invites set email = 'seu-email@gmail.com' where system_role='admin' and status='pendente';`

## Como testar (depois do OAuth)

`npm run dev` → `http://localhost:3000` → **Entrar com Google** com o email do convite.
O trigger casa o convite e cria seu profile já como **admin/ativo** → cai no `/inicio` (visão
admin) com o culto de domingo pedindo escala. Fluxo completo: **Pessoas** → convidar líder e
voluntários (com equipes) → cada um loga e entra direto → líder abre o culto → **Escalar** as
posições → voluntário confirma/recusa. Login com email SEM convite → cai em `/aguardando`
(fila) → admin aprova em **Pessoas → "Entraram sem convite"**.

## Próximo: Fase 2 (ver [PLAN.md](PLAN.md) §10)

Calendário mensal · disponibilidade (+flag na hora de escalar) · troca/substituto · check-in ·
histórico exposto · interesses (UI) · templates de série · edição de ocorrência única ·
responsável do evento · aniversários · líder solicita evento → admin aprova.

## Invariantes de segurança (NÃO regredir) — ver PLAN §6/§11

View `v_assignment_history` com `security_invoker`; `handle_new_user` de 2 portas;
confirmar/recusar só via RPC; eventos/séries só admin; `check_position_in_team`;
`profiles_guard_privileged`; leituras gated em `is_active()`; helpers de RLS e RPCs
`authenticated`-only (0004). **Não é multi-tenant** (policies `using(true)`, sem filtro por `church_id`).
