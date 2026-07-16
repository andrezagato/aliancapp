# Checklist de validação — E-mail / Resend (Fase 3B) · Sirvo

Branch `feat/fase-2` · commit `2f4b707`

Objetivo desta leva: mandar e-mail de verdade nos fluxos que o sino (in-app) não
cobre bem — principalmente **convite** (que antes não avisava ninguém) e **escalado**
(canal garantido no iPhone, além do sino).

---

## ✅ Já feito e validado nesta sessão
- [x] `resend` instalado
- [x] Domínio `ministerioalianca.com` **verificado** no Resend (DKIM + SPF + MX, região São Paulo)
- [x] **DMARC** (`p=none`) adicionado no HostGator (só observa, não bloqueia)
- [x] Google Workspace intacto (MX/CNAMEs do Google não foram tocados)
- [x] Remetente: **`Sirvo na Aliança <avisos@ministerioalianca.com>`** (acentos `ç`/`á` renderizam certo)
- [x] Teste real: envio **do domínio** para e-mail **externo** (não é a conta Resend) → chegou
- [x] Variáveis no `.env.local` (local) e na **Vercel** (produção)
- [x] Código commitado + push

---

## 🔎 Para validar agora no app (ponta a ponta)

### 1. Convite por e-mail  ·  o grande objetivo desta leva
Como **admin** → **Pessoas** → **Convidar** → preencha nome + um e-mail **seu** de teste.
- [ ] Chega o e-mail com assunto **"Sirvo — você foi convidado para servir"**
- [ ] O **remetente** aparece como **"Sirvo na Aliança"**
- [ ] O botão **"Entrar no Sirvo"** abre o app (em produção, aponta pro domínio de produção — **não** `localhost`)
- [ ] Login com Google usando **aquele e-mail** → entra no fluxo certo (casa com o convite)
- [ ] Na 1ª vez, se cair no **spam**, marque **"não é spam"** (ajuda a reputação)

### 2. Escalado por e-mail
Como **admin/líder** → em um evento, **escale alguém** numa posição (use um e-mail seu).
- [ ] Chega e-mail **"Sirvo — você foi escalado: {evento}"** com **data/hora**
- [ ] Botão **"Ver e confirmar"** abre a tela do culto (`/escalas/{evento}`)
- [ ] O **sino (in-app)** também disparou (os dois canais funcionam juntos)

### 3. Best-effort (não pode quebrar a ação)
- [ ] Se o e-mail falhar (ex.: endereço estranho), **criar convite / escalar continua funcionando** — só não sai o e-mail (falha silenciosa proposital)

---

## ⚙️ Conferir na produção (Vercel)
- [ ] `RESEND_API_KEY` presente (**Sensitive ON**) em Production
- [ ] `RESEND_FROM_EMAIL = Sirvo na Aliança <avisos@ministerioalianca.com>` em Production
- [ ] O **deploy novo** rodou **depois** de adicionar as variáveis (senão o app no ar ainda não as enxerga)
- [ ] O link do convite no e-mail aponta pro **domínio de produção** correto
  - Obs.: se `NEXT_PUBLIC_SITE_URL` não estiver setado, o app usa a URL de produção da Vercel automaticamente

---

## 🕗 Pendências / próximos passos (não são bugs)
- [ ] **`evento_alterado`**: o *tipo* de aviso existe, mas **nenhuma ação o dispara** ainda (falta o fluxo de **editar evento**). Quando existir, ligar sino + e-mail.
- [ ] **Preferência de canal (`notification_prefs`)**: hoje os fluxos wired sempre mandam e-mail; respeitar a preferência por pessoa fica pra depois.
- [ ] **Fase 3C** (push / Service Worker + VAPID): adiada por escolha sua.
- [ ] **Domínio custom do app** na Vercel (se quiser um link mais bonito que `*.vercel.app`).
- [ ] **Spam/reputação**: melhora com o tempo + as pessoas marcando "não é spam".
- [ ] **(Opcional)** `rua=` no DMARC, se um dia quiser receber relatórios.
- [ ] **(Opcional)** padronizar o prefixo do assunto ("Sirvo —") com o remetente ("Sirvo na Aliança").

---

## 🗄️ Mudança no banco nesta leva
- **Nenhuma.** Fase 3B é só app + configuração externa (DNS/Resend/Vercel). As migrations 0009/0010 são das levas anteriores.

---

## 📂 Arquivos e commit desta leva
- `src/lib/email.ts` — **novo**: `sendEmail()` (server-only, best-effort) + templates (convite, escalado) + `siteUrl()`
- `src/lib/actions.ts` — `criarConvite` (e-mail ao convidado) + `escalarVoluntario` (e-mail ao escalado)
- `package.json` / `package-lock.json` — dependência `resend`
- Commit: **`2f4b707`** — *feat: envio de e-mail via Resend (Fase 3B) — convite + escalado*
