# Checklist de validação — Sirvo (feat/fase-2)

Marque `[x]` conforme validar. Tudo está na **preview da Vercel** (atualiza a cada push):

**https://aliancapp-git-feat-fase-2-andrezagatos-projects.vercel.app**

Login: **Google** (seu e-mail) ou **link mágico**. Pra ver visões de líder/voluntário sem trocar de
conta, use as personas de teste (só aparecem em dev/local, não na Vercel).

---

## ✅ Já validado por você
- [x] **Leva 1** — cabeçalho não sobrepõe mais ao rolar; trocar de conta Google; "Solicitar entrada" sem "Load failed".
- [x] **Item 6** — home do admin reorganizada (herói no topo → pendências → resumo).
- [x] Redesenho geral no celular ("funcionou, como esperado") + logo real da Aliança.

---

## 🔎 Para validar agora (o que entrou nesta leva)

### Evento — modo Ver/Editar (item 5)  ·  tela de um culto, como admin/líder
- [V] Abre com as equipes **recolhidas** (só cabeçalho: equipe + cobertura + **!** onde há vaga/troca).
- [V] Tocar numa equipe **expande**; tocar de novo recolhe.
- [V] Botão **"Expandir tudo / Recolher tudo"** funciona.
- [X] A escolha **fica salva** (recarrega a página e volta do mesmo jeito).
- [V] **Modo Ver** (padrão): cada pessoa em 1 linha, status pela **cor da borda** (verde/âmbar/vermelho), check quem fez presença, **!** onde há troca.
- [V] Botão **"Editar"** revela os controles (precisa −N+, não se aplica, lixeira, escalar, aprovar/recusar troca) e também fica salvo.
- [V] Líder com 1 equipe: já abre expandida.

### Pessoas — filtro por equipe (item 8)
- [V] Chips de equipe no topo do diretório; **1 por vez** filtra a lista.
- [V] "Todas" volta pra lista completa; cabeçalho mostra a equipe + contagem.
- [V] Sumiu o sort "Mais equipes" (ficou A–Z / Recentes).

### Apelido (item 7)  ·  ⚠️ mexeu no banco (migração aditiva — ver seção no fim)
- [V] **Perfil → linha "Apelido"**: adicionar/editar seu apelido salva e aparece toast.
- [V] Cabeçalho do Perfil mostra **apelido grande + nome completo pequeno**.
- [V] No **Escalar** (líder escolhendo): candidato aparece como **apelido · nome real**.
- [V] No **diretório de Pessoas**: idem (apelido em destaque + nome ao lado).

### Criar evento (item 9)  ·  admin → Criar evento
- [V] Tudo num **card só**: modelos no topo (cards com ícone + contagem) → infos → "Equipes que vão servir".
- [V] Acabou a sensação de "box das infos + equipes soltas embaixo".
- [V] Tocar num modelo preenche título/hora/local/equipes.

### Performance percebida (skeletons)
- [V] Ao navegar entre abas, aparece um **esqueleto pulsando** enquanto carrega (em vez de tela travada).
      *(A lentidão de fundo — região Vercel↔Supabase — é item separado, ver pendências.)*

---

## 🕗 Pendências conhecidas (não são bugs — decisões/próximos passos)
- [ ] **Apelido no cadastro (signup):** hoje a pessoa define no Perfil. Capturar já no "Solicitar entrada" exige atualizar a RPC `solicitar_entrada` — deixei pra depois.
- [ ] **E-mail (convite + link mágico):** Fase 3 (Resend). Hoje: adicionar gente = **Convidar** (Pessoas) + mandar o link + a pessoa entra com Google/e-mail convidado.
- [ ] **Performance de navegação:** alinhar a **região da função Vercel** com a do Supabase (corta a latência de várias consultas por tela). Precisa de 1 ajuste no painel da Vercel — me diga a região do seu Supabase que eu configuro.
- [ ] **Hardening de segurança:** rever grants de funções expostas + "leaked password protection" (avisos do linter do Supabase). Não bloqueia nada.
- [ ] **"Resumo" na home do admin:** você achou pouco útil — candidato a **remover**. Mantido por ora; me confirma se tiro.

---

## 🗄️ Mudança no banco aplicada nesta leva
Migração **`supabase/migrations/0008_profile_nickname.sql`** (já aplicada no Supabase):
```sql
alter table public.profiles add column if not exists nickname text;
```
Aditiva e reversível (coluna nova, nullable). Não altera nem apaga dados existentes; queries antigas
seguem funcionando. Reverter, se quiser: `alter table public.profiles drop column nickname;`

---

## Commits desta leva (branch feat/fase-2)
- `570d2af` — Leva 1 (cabeçalho, cadastro server action, Google select_account)
- `1251b9b` — item 6 (home admin)
- `1cf9251` — item 5 (evento Ver/Editar)
- `62be90b` — itens 8 e 9 + skeletons
- `da63d32` — item 7 (apelido) + migração 0008

---

## 🔁 Ajustes após seu retorno (re-testar)
- [ ] **Perfil → editar Nome**: dá pra definir/editar o nome completo (linha "Nome", ao lado do Apelido).
- [ ] **Evento (modo Ver): status virou tag** ("Confirmado" / "Aguardando" / "Recusou") na mesma linha do nome — no lugar da barrinha colorida sutil.
- [x] ~~Salvar posição aberta/fechada~~ — deixado como está (mínimo), conforme combinado.
