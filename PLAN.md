# Aliança — App de Escalas de Equipes (PWA)

> **Nome provisório.** Pasta local `servir/`, repositório `aliancapp`. Definir o nome final
> (ver §13). Projeto **pessoal** do André — substituto do **Timbragem Plan**: mais bonito,
> mais simples e mais amplo.

---

## 1. Visão

O Timbragem (timbragemplan.com.br, 4.3★/57) é, na prática, um app de **ministério de louvor**
(repertório/cifras) com escala como coadjuvante. Reclamações recorrentes: **suporte
inexistente** e **reset de senha quebrado**. Limitado e datado.

**O que fazemos diferente:**
- Escalar **todas as equipes** da igreja (louvor, som, mídia, recepção, kids, limpeza…).
- Fluxo **escalar → confirmar/cancelar** no centro, com disponibilidade prévia, troca de
  voluntário e motivo/antecedência no cancelamento.
- **Login sem senha** (Google) — mata o ponto onde o concorrente falha.
- Visual **acolhedor/quente**, PWA instalável no iPhone e Android.

**Resultado esperado (MVP):** a igreja usa de verdade num culto real — cadastrar pessoas,
montar a escala do domingo, cada um confirma/cancela pelo celular, e no dia bate o check-in.

---

## 2. Decisões travadas

| Tema | Decisão |
|------|---------|
| Escopo de equipes | **Todas** as equipes/ministérios (posições configuráveis por equipe) |
| Multi-igreja | **Uma igreja** hoje (schema com `church_id`, mas RLS ainda NÃO é multi-tenant — ver §6) |
| Ambição | **MVP enxuto e bonito** |
| Plataforma | **PWA instalável** (iOS + Android), sem loja |
| Papéis | **Admin + Líder (por equipe) + Voluntário**; a mesma pessoa pode ser líder numa equipe e voluntário em outra |
| Quem cria evento | **Só admin.** Líder pode **solicitar** evento → admin aprova (Fase 2) |
| Responsável do evento | Campo no evento (ex.: pastor do culto) que **confirma que o evento vai acontecer** (Fase 2) |
| Eventos | Recorrentes (série) + avulsos; série tem **template de equipes/posições** |
| Disponibilidade | Voluntário marca quando **não pode** + pode cancelar depois de escalado com **motivo** |
| Ao cancelar | Notifica o líder + voluntário pode **propor substituto** + exige justificativa/antecedência |
| Login | **Convite do admin + Google** (Apple fora do MVP — ver §13) |
| Onboarding | **Duas portas:** convite (entra direto) **ou** auto-cadastro (fila de aprovação) — ver §4 |
| Avisos | **Push PWA + sino + email**, roteados por escopo (ver §7). WhatsApp fica pra depois |
| Backend | **Supabase** (Postgres+Auth+Storage+Realtime) + **Vercel** (frontend) |
| Visual | **Acolhedor / quente** |
| Visibilidade | Voluntário vê **só a escala da própria equipe**; líder tem **visão calendário mensal** |
| Check-in | **Sim, no MVP** — auto-declarado (a UI deixa claro: presença auto-reportada, não verificada) |
| Aniversário | Visível **pra igreja toda** |

---

## 3. Papéis & permissões

- **Admin:** cadastra pessoas/equipes, define líderes e responsáveis, **cria/edita/cancela
  eventos e séries**, aprova `join_requests` e `event_requests`, vê tudo.
- **Responsável do evento** (`events.responsible_id`): confirma que o evento acontece;
  não é papel global, é policy por campo (Fase 2).
- **Líder** (`memberships.role='leader'`): escala **a própria equipe**, aprova trocas, marca
  posição como "não se aplica", vê check-in e calendário. **Não** cria/edita eventos —
  apenas **solicita** (Fase 2).
- **Voluntário:** vê a escala da própria equipe, confirma/cancela (com motivo), marca
  indisponibilidade, propõe substituto, faz check-in.

---

## 4. Onboarding — duas portas

O trigger `handle_new_user` (Supabase Auth) decide o destino de todo login novo:

1. **Convidado** — o admin criou um `invite` com o email da pessoa (nome, equipes, função).
   No 1º login o trigger **casa por email** → provisiona `profile` + `church` + `memberships`
   → **entra direto** (o admin já aprovou ao convidar).
2. **Não-convidado** — veio pelo link/QR ou logou espontaneamente. Vai pra `join_requests`
   e o `profile` fica **pendente** (`status='pendente'`, `church_id` null) → tela
   "aguardando aprovação" → admin aprova → vira membro.

**Propriedade importante:** se o admin convidar `joao@work.com` mas o João logar com
`joao@gmail.com`, **nada quebra** — ele só não casa o convite e cai na fila de aprovação.
O convite é o atalho; a aprovação é a rede de segurança.

> Isso corrige o comportamento do schema original, onde **qualquer** login virava membro
> automaticamente e a fila de aprovação era código morto.

---

## 5. Modelo de dados (Supabase / Postgres)

Todas as tabelas carregam `church_id`. **Núcleo** = `assignments`.

| Tabela | Papel |
|--------|-------|
| `churches` | A igreja. Nome, fuso, logo, `join_code`. |
| `profiles` | Pessoas (1:1 com `auth.users`). Nome, foto, telefone, **`birth_date`**, `system_role`, **`status` (pendente/ativo)**, `church_id` **nullable** (pendentes). |
| `teams` | Equipes/ministérios. Nome, cor, ícone, **`archived_at`** (soft-delete). |
| `positions` | Funções por equipe. **`archived_at`** (soft-delete). |
| `memberships` | Pessoa ↔ equipe (N por pessoa): `role` (leader/volunteer). |
| `member_positions` | Quais posições a pessoa sabe fazer naquela equipe. |
| `invites` (+ `invite_teams`) | **NOVO.** Convite pré-login: email, nome, equipes/função pretendidas, token, status. |
| `event_series` | Recorrência (weekday + horário). |
| `series_requirements` | **NOVO.** Template: por série, quais posições e **quantas pessoas** (`needed_count`). |
| `events` | Ocorrência: data/hora, título, local, **`responsible_id`**, **`confirmed_at`/`confirmed_by`**. Editar uma ocorrência **não** afeta a série (é cópia materializada). |
| `event_requirements` | **NOVO.** Requisitos **efetivos** por evento (copiados do template, editáveis): `needed_count`, `status` (**needed / not_applicable**), note. É o **denominador** da cobertura e onde mora o "não se aplica". |
| `event_requests` | **NOVO (Fase 2).** Líder solicita criação de evento → admin aprova. |
| `assignments` | **Núcleo:** event × team × position × profile + status. `profile_id` null = vaga aberta. |
| `availability_blocks` | Datas em que a pessoa **não pode**. |
| `swap_requests` | Pedido de troca/substituto ligado a um `assignment`. |
| `checkins` | Presença no dia (1 por assignment). |
| `join_requests` | Auto-cadastro pendente de aprovação. |
| `service_interests` | "Quero servir/aprender em X" → notifica o líder. |
| `notifications` | Sino in-app. `team_id` **nullable** (avisos por-pessoa/por-evento). |
| `notification_prefs` | Canais (push/email/sino) por pessoa e tipo. |
| `push_subscriptions` | Assinaturas Web Push (Fase 3). |

- **Cobertura de escala** = para cada `event_requirement` com `status='needed'`:
  `count(assignments preenchidos) >= needed_count`. Verde/amarelo/vermelho do calendário
  sai daqui. `not_applicable` não conta como buraco.
- **Histórico** ("quem já serviu / última vez") = **view** `v_assignment_history`
  (com `security_invoker = on` — ver §6).

---

## 6. Correções de segurança no schema (vs. `0001` original)

Bugs encontrados no `0001_init.sql` já commitado, a corrigir antes de empilhar a Fase 1:

1. **🔴 View de histórico vazava a escala inteira** (view comum roda como o dono → ignora RLS
   de quem consulta). → `alter view … set (security_invoker = on)`.
2. **🔴 Trigger de auth punha qualquer login na igreja** (aprovação virava código morto)
   e **quebrava o login se a igreja não existisse** (NULL em `church_id`).
   → reescrito pro fluxo de duas portas + guard.
3. **🔴 Impossível pré-cadastrar pessoa** (`profile` exige `auth.users`). → tabela `invites`.
4. **🟠 Qualquer líder editava/apagava qualquer evento/série.** → eventos/séries **só admin**;
   líder mexe só em `assignments` e no "não se aplica" da própria equipe.
5. **🟠 Voluntário podia editar demais a própria escalação** (trocar team/position, forjar
   `presente`). → confirmar/recusar via **RPC `security definer`** com transições válidas;
   policy de self-update apertada.
6. **🟠 Sem integridade posição↔equipe↔membro.** → `assignment` amarrado ao
   `event_requirement` (par equipe+posição válido) ou trigger de checagem.
7. **🟡 Delete de equipe/posição destruía histórico** (cascata). → **soft-delete** (`archived_at`).

> **Multi-igreja:** o schema tem `church_id`, mas as policies de leitura são `using(true)`
> e `is_admin()` é global. Ou seja: **não é multi-tenant hoje** — quando entrar a 2ª igreja,
> as policies precisam ser reescritas pra filtrar por `church_id`. Decisão consciente (fora
> de escopo do MVP), documentada pra não surpreender depois.

---

## 7. Notificações — compartimentação (a "joia")

Três escopos (o schema já suporta com `notifications.team_id` nullable):

- **Por-equipe** (`team_id` preenchido): escalado, cancelou, vaga aberta, interesse em servir,
  cobertura. Roteia **só pra quem tem escopo naquela equipe** — líder recebe apenas da(s)
  equipe(s) que lidera; voluntário só o que é dele. **Nunca broadcast.**
- **Por-evento** (`team_id` null, ligado ao evento): **mudança de evento** (horário/data) vai
  a **todos os escalados no dia**, cross-team por natureza.
- **Por-pessoa** (`team_id` null): confirmação do responsável, convite, aprovação de cadastro.
- **Aniversário:** exceção deliberada — visível/avisado pra igreja toda.

Enum `notification_kind` estende: `evento_alterado`, `aniversario`, `responsavel_confirmar`,
`cobertura`.

**Canais:**
- **Sino (in-app):** protegido por RLS (`recipient_id`) + Realtime.
- **Push (VAPID) + Email (Resend):** enviados por **Edge Function** (service-role) que resolve
  destinatários **pelo escopo** — aqui a compartimentação é garantida por **código**, não por
  RLS, então precisa de teste próprio (ver §11).
- **⚠️ iOS:** Web Push só funciona em **PWA instalada na tela inicial** (iOS 16.4+), nunca na
  aba do Safari, e sem prompt automático de instalação. → **email é o canal garantido no
  iPhone**; push é best-effort. Avisos críticos (escalado, evento mudou) **sempre** vão por
  email também. Onboarding iOS precisa ensinar "Compartilhar → Adicionar à Tela de Início".

---

## 8. Telas do MVP

1. **Login / onboarding** — Google; convite entra direto; auto-cadastro → "aguardando aprovação".
2. **Home por papel** — voluntário (próximas + pendentes + indisponibilidade + aniversários);
   líder (equipes, vagas, quem falta confirmar, alerta de evento sem escala); admin (visão
   geral + pendências: aprovações, buracos, eventos aguardando confirmação do responsável).
3. **Calendário** — mês inteiro, **badge de status por equipe** (verde/amarelo/vermelho).
4. **Evento / escala** — voluntário vê só a própria equipe; líder edita, marca "não se aplica".
5. **Criar/editar evento (admin)** — série (com template) ou avulso; definir responsável;
   editar **ocorrência única** sem afetar a série.
6. **Confirmação do responsável** — confirma "o evento vai acontecer".
7. **Escalar (líder)** — posição → aptos com flag de indisponível + histórico "última vez que
   serviu" → atribui → convite.
8. **Confirmar/Cancelar (voluntário)** — confirma; ou cancela com motivo + propõe substituto.
9. **Disponibilidade** — calendário de datas que não pode.
10. **Check-in** — no dia; auto-declarado, com o objetivo explícito na UI.
11. **Pessoas** — admin/líder adiciona/edita, equipes/posições, `birth_date`; fila de aprovação.
12. **Equipes & posições** — admin cria equipes e funções.
13. **Notificações (sino)** — central + preferências de canal.
14. **Histórico** — por pessoa e por função (rodízio justo).
15. **Interesses de serviço** — sinaliza interesse → notifica o líder.
16. **Alertas de cobertura** — admin configura "avisar X dias/horas antes se a equipe Y não
    tem escala".

---

## 9. Identidade visual (acolhedor / quente)

- **Paleta:** base creme/off-white; primária terracota/âmbar; acento verde-musgo ou marrom
  profundo; texto grafite.
- **Forma:** cantos bem arredondados, sombras suaves, cards espaçados. Tipografia amigável
  (Inter + Fraunces nos títulos).
- **Tom:** microcopy calorosa em PT-BR, estados vazios convidativos. **Sem emoji na UI**
  (só ícones Lucide/SVG).
- Dark mode: refinamento pós-MVP.

---

## 10. Fases

- **Fase 0 — Fundação** ✅ (commit `e927ad9`): Next.js PWA + Tailwind/shadcn + tema quente;
  schema + RLS + auth Google; manifest instalável.
- **Fase 0.5 — Rework do schema** (esta): migração com as correções da §6 + `invites` +
  requisitos + campos da Fase 2.
- **Fase 1 — Núcleo escalar→confirmar** ✅: queries reais, auth gate + fila de aprovação,
  home por papel, escalas (lista + detalhe), server actions (escalar/confirmar/cancelar),
  criar evento **avulso**, onboarding de duas portas (convite + auto-cadastro/aprovação).
  Só Google. Supabase cloud. Falta só o Google OAuth (passo manual) pra testar logado.
- **Fase 2 — Diferenciais + gestão de evento** ✅ (branch `feat/fase-2`): gestão de
  equipes/posições/membros; diretório de pessoas; modelos de evento; calendário mensal;
  disponibilidade + flag/trava no escalar; troca/substituto (substituto aceita → líder aprova);
  check-in; interesses; "não se aplica"; responsável do evento confirma; histórico + "última
  vez que serviu"; aniversários. Migrações 0002–0007. (Pendências p/ depois: auto-cadastro por
  QR, edição de ocorrência única, líder solicita evento → admin aprova.)
- **Fase 3 — Avisos compartimentados:** sino Realtime; Web Push (VAPID + Edge Function) +
  email (Resend), roteados por escopo; preferências de canal; máquina de recorrência
  (gerar ocorrências da série) + jobs agendados (lembrete D-1, alerta de cobertura).
- **Roadmap pós-MVP:** WhatsApp; roteiro/ordem do culto (setlist, preletor, avisos, mídias,
  link OneDrive → upload); relatórios de assiduidade; multi-igreja + billing; app nativo.

---

## 11. Verificação (ponta a ponta)

1. Seed + Supabase cloud → `npm run dev`.
2. Fluxo com 3 contas (admin, líder, voluntário): admin **convida** voluntário → voluntário
   loga e entra provisionado → admin cria evento → líder escala (flag de indisponível +
   histórico) → voluntário confirma; noutro evento cancela com motivo + propõe substituto →
   líder aprova; admin edita **só a ocorrência** → escalados notificados, série intacta; líder
   marca "não se aplica" → cobertura ignora; check-in no dia.
3. **Calendário:** líder vê o mês, badges por equipe.
4. **Cobertura:** "3 dias antes" → aviso chega quando equipe sem escala.
5. **Auth:** Google; convite; auto-cadastro → aprovação; **mismatch de email cai na fila**.
6. **PWA:** instalar (Android + iPhone), push chegando (iPhone: só instalado), Lighthouse verde.
7. **RLS:** voluntário não vê escala de outra equipe (app **e** SQL **e** a view de histórico).
8. **Compartimentação (crítico):** 2 líderes (louvor/som) + pessoa em ambas → mexer no som
   **não** gera aviso (push/email/sino) pro líder de louvor.
9. **Interesse:** marca interesse em mídia → só o líder de mídia é notificado.
10. **Aniversário:** perfil com data de hoje → aviso na home.

---

## 12. Fora de escopo (por decisão)

- Multi-igreja / billing. • Repertório/cifras/arquivos (foco do Timbragem). • Roteiro completo
  do culto com mídias (roadmap). • WhatsApp. • App nativo nas lojas. • Login Apple (§13).

---

## 13. Pendências de decisão

- **Nome:** pasta `servir/` vs repo `aliancapp`. "Servir", "Aliança", outro? (afeta manifest,
  logo, domínio).
- **Login Apple:** fora do MVP (exige Apple Developer pago + complicação de relay-email no
  convite). Reavaliar no deploy público.

---

## 14. Stack & infra

- **Frontend:** Next.js (App Router) PWA (Serwist) → **Vercel**. UI: Tailwind + shadcn/ui +
  ícones **Lucide** (só SVG, nunca emoji).
- **Backend:** **Supabase** (Postgres 15 + Auth + Storage + Realtime). RLS por papel.
- **Email:** **Resend** (tier grátis). **Push:** VAPID via Edge Function (Deno).
- **Repo:** `git@github.com:andrezagato/aliancapp.git`.
- **Aplicar o schema:** Supabase CLI (`supabase db push`, versionado em `supabase/migrations/`)
  **ou** SQL Editor (colar e rodar). Ver README.
