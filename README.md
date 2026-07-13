# Servir

App de **escalas de equipes para igreja** (PWA). O líder escala um voluntário numa
posição de um evento; o voluntário confirma ou cancela. Todas as equipes (louvor, som,
mídia, recepção, kids…), avisos compartimentados por equipe, disponibilidade, troca de
voluntário, check-in e interesse em servir.

> Projeto pessoal. Alternativa mais bonita e ampla ao Timbragem Plan.
> Visão completa do produto: veja o plano de referência (`gleaming-forging-tide.md`).

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

Sem preencher o `.env.local`, o app abre em **modo demonstração** (dados de exemplo,
sem login). A tela `/entrar` tem o link "Ver demonstração".

### Banco de dados

**Opção A — Supabase Cloud (recomendado):**
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em *SQL Editor*, rode o conteúdo de `supabase/migrations/0001_init.sql`.
   (Opcional: rode `supabase/seed.sql` para dados de demonstração.)
3. Copie `Project URL` e `anon key` (Settings → API) para o `.env.local`.

**Opção B — Supabase local (Docker):**
```bash
npx supabase start          # sobe Postgres + Studio local
npx supabase db reset       # aplica migrations + seed.sql
npm run db:types            # regenera os tipos TypeScript
```

### Login social (Google / Apple)

No Supabase: *Authentication → Providers* → habilite **Google** e **Apple**,
colando os Client ID/Secret dos respectivos consoles. Em *URL Configuration*,
adicione o redirect `http://localhost:3000/auth/callback` (e o domínio de produção).

## Estrutura

```
src/
  app/
    (auth)/entrar/        # login Google/Apple
    (app)/                # área logada (bottom nav): inicio, escalas, disponibilidade, perfil, notificacoes
    cadastro/             # auto-cadastro público (join_requests)
    auth/callback/        # troca o code OAuth por sessão
    manifest.ts           # PWA manifest
  components/ui/          # Button, Card, Badge, Avatar
  components/app-shell/   # TopBar, BottomNav
  lib/supabase/           # clients browser/server + tipos do banco
  lib/demo.ts             # dados de demonstração (Fase 0)
supabase/
  migrations/0001_init.sql  # schema + RLS + triggers + view de histórico
  seed.sql                  # dados de demonstração
```

## Roadmap (fases)

- **Fase 0 — Fundação** ✅ scaffold, tema, PWA, schema+RLS+seed, login, shell navegável.
- **Fase 1** — núcleo escalar→confirmar/cancelar ligado ao Supabase (substituir `lib/demo.ts`).
- **Fase 2** — disponibilidade, troca/substituto, check-in, auto-cadastro+aprovação, histórico, interesses.
- **Fase 3** — avisos: sino realtime + Web Push (VAPID/Edge Function) + email (Resend), compartimentados por equipe.

## Convenções

- **Ícones: só Lucide (SVG), nunca emoji pictográfico na UI.**
- Rotas em português; textos calorosos.
- Migration nova = arquivo em `supabase/migrations/` com RLS + GRANT.

## Deploy (Vercel)

1. Suba o repo no GitHub e importe na Vercel.
2. Configure as env vars (as mesmas do `.env.example`).
3. Ajuste o redirect de OAuth do Supabase para o domínio de produção.
