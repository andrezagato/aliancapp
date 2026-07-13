# Servir

App de **escalas de equipes para igreja** (PWA). O líder escala um voluntário numa
posição de um evento; o voluntário confirma ou cancela. Todas as equipes (louvor, som,
mídia, recepção, kids…), avisos compartimentados por equipe, disponibilidade, troca de
voluntário, check-in e interesse em servir.

> Projeto pessoal. Alternativa mais bonita e ampla ao Timbragem Plan.
> Visão completa do produto e decisões: veja [`PLAN.md`](PLAN.md).

## Stack

- **Next.js 15 (App Router)** como **PWA** → deploy na **Vercel**
- **Supabase** (Postgres + Auth + Realtime + Storage) com **RLS**
- **Tailwind CSS** + componentes próprios + ícones **Lucide**
- Tema **acolhedor/quente** (creme + terracota + verde-musgo)

## Rodando localmente

Pré-requisitos: **Node 18+** e (opcional) **Docker** para o Supabase local.

```bash
npm install
cp .env.example .env.local     # preencha as chaves do Supabase
npm run dev                    # http://localhost:3000
```

O app **exige** o `.env.local` preenchido (URL + anon key do Supabase) — sem isso o
login não funciona e as rotas logadas redirecionam para `/entrar`.

### Banco de dados

O projeto Supabase **já está provisionado** (`project_ref = acwpsnfvliidyxtjevfv`).
O schema (`0001_init.sql`) e as migrações de hardening (`0002`–`0004`) já foram aplicados.

Para clonar do zero em outro projeto:
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Aplique as migrações em ordem: `supabase/migrations/0001_init.sql` … `0004_lock_functions.sql`
   (via *SQL Editor* ou `supabase db push`).
3. Rode `supabase/seed_cloud.sql` para criar igreja + convite de admin + equipes + culto inicial.
4. Copie `Project URL` e `anon key` (Settings → API) para o `.env.local`.

> `supabase/seed.sql` (com `auth.users` fake) é só para o **dev local com Docker**, não para o cloud.

### Login (Google) — passo manual pendente

No Supabase: *Authentication → Providers* → **Google**, colando Client ID/Secret do
Google Cloud Console. Em *URL Configuration*: Site URL `http://localhost:3000` e
Redirect `http://localhost:3000/**` (+ o domínio de produção). Apple ficou fora do MVP.

## Estrutura

```
src/
  app/
    (auth)/entrar/        # login com Google
    (app)/                # área logada (bottom nav): inicio, escalas[/id][/novo], disponibilidade, pessoas, perfil, notificacoes
    aguardando/           # fila de aprovação (profile pendente)
    cadastro/             # auto-cadastro público -> RPC solicitar_entrada
    auth/callback/        # troca o code OAuth por sessão
    manifest.ts           # PWA manifest
  components/ui/          # Button, Card, Badge, Avatar
  components/app-shell/   # TopBar, BottomNav (role-aware)
  components/             # coverage-badge, assignment-response, leader-controls, people-controls, novo-evento-form…
  lib/auth.ts             # getSession (user + profile + equipes + papel efetivo)
  lib/data.ts             # queries de leitura (home, escalas, pessoas) — server-only
  lib/actions.ts          # server actions (escalar/confirmar/recusar/criar evento/convites/aprovações)
  lib/coverage.ts         # cálculo de cobertura (denominador)
  lib/format.ts           # datas pt-BR no fuso da igreja
  lib/supabase/           # clients browser/server + tipos gerados do banco
supabase/
  migrations/0001_init.sql        # schema + RLS + triggers + view de histórico
  migrations/0002_hardening.sql   # search_path + revoke em funções de trigger
  migrations/0003_public_join.sql # RPC solicitar_entrada (auto-cadastro anon)
  migrations/0004_lock_functions.sql # least-privilege (helpers/RPCs só authenticated)
  seed_cloud.sql                  # igreja + convite admin + equipes + culto (cloud)
  seed.sql                        # dados fake p/ dev local (Docker)
```

## Roadmap (fases)

- **Fase 0 — Fundação** ✅ scaffold, tema, PWA, schema+RLS+seed, login, shell navegável.
- **Fase 1 — Núcleo escalar→confirmar** ✅ queries reais, auth gate + fila de aprovação,
  home por papel, escalas (lista + detalhe), server actions (escalar/confirmar/recusar),
  criar evento avulso, convites + aprovações. Login só Google. Sem `lib/demo.ts`.
- **Fase 2** — calendário mensal, disponibilidade, troca/substituto, check-in, histórico,
  interesses, templates de série, edição de ocorrência, responsável do evento, aniversários.
- **Fase 3** — avisos: sino realtime + Web Push (VAPID/Edge Function) + email (Resend), compartimentados por equipe.

## Convenções

- **Ícones: só Lucide (SVG), nunca emoji pictográfico na UI.**
- Rotas em português; textos calorosos.
- Migration nova = arquivo em `supabase/migrations/` com RLS + GRANT.

## Deploy (Vercel)

1. Suba o repo no GitHub e importe na Vercel.
2. Configure as env vars (as mesmas do `.env.example`).
3. Ajuste o redirect de OAuth do Supabase para o domínio de produção.
# aliancapp
# aliancapp
