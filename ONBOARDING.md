# Onboarding — como uma pessoa entra na igreja (Sirvo)

Hoje existem **3 portas de entrada** que caem em **3 estados diferentes** que o admin gerencia
na aba **Pessoas**. É isso que dá a sensação de "não faz muito sentido" — dá pra simplificar
(ver o fim). Abaixo, cada caminho passo a passo + onde os avisos entram.

---

## Caminho 1 — Convite (admin chama alguém)
1. Admin → **Pessoas → Convidar pessoa** → nome + email + equipes/função.
2. Cria um registro em **`invites`** (status pendente). **Não envia e-mail ainda** (Fase 3B/Resend).
3. Admin **manda o link do app** pra pessoa (WhatsApp etc.).
4. A pessoa faz **login com Google/link mágico usando aquele e-mail**.
5. O trigger `handle_new_user` **casa o convite pelo e-mail** → cria `profile` + liga à igreja +
   `memberships` → **entra direto** (já aprovada).

> ⚠️ Se a pessoa logar com um e-mail **diferente** do convidado, o convite não casa e ela cai no
> Caminho 3 (entrou sem convite → precisa aprovar na mão).

## Caminho 2 — Auto-cadastro pelo formulário (pessoa pede antes de logar)
1. Pessoa abre **/entrar → "Solicitar entrada"** (`/cadastro`), preenche e envia.
2. Cria um registro em **`join_requests`** (pré-login; via server action → RPC `solicitar_entrada`).
3. Admin vê em **Pessoas → "Pediram para entrar"** → **Aprovar**.
4. Aprovar (`aprovarJoinRequest`) **transforma em convite** (`invites`) — **não vira membro na hora**.
5. A pessoa ainda precisa **logar com aquele e-mail** → aí entra (igual ao Caminho 1, passo 5).

## Caminho 3 — Login espontâneo sem convite
1. Pessoa faz **login com Google** sem ter sido convidada.
2. O trigger cria um **`profile` pendente** (status `pendente`, sem igreja) → cai na tela **/aguardando**.
3. Admin vê em **Pessoas → "Entraram sem convite"** → **Aprovar** (`aprovarProfilePendente`).
4. Aprovar **ativa o profile direto** + cria `memberships` → **vira membro na hora** (não precisa relogar).

---

## Onde os avisos (sino) entram
| Momento | Aviso | Pra quem | Status |
|---|---|---|---|
| Pessoa é **aprovada** (Caminho 3) | `cadastro_aprovado` "Bem-vindo!" | a própria pessoa | ✅ feito |
| Alguém **pede pra entrar** (Caminhos 2 e 3) | `cadastro_pendente` | admin | ✅ feito |
| **Convite** criado | e-mail com o link | a pessoa convidada | 🕗 Fase 3B (Resend — ver EMAIL-RESEND.md) |

O `cadastro_pendente` é disparado pelos dois lados: a RPC `solicitar_entrada` avisa os admins quando
alguém usa o formulário, e um trigger em `profiles` avisa quando alguém loga sem convite.

---

## ✅ Checklist de teste (onboarding)
### Convite
- [ ] Convidar um e-mail → aparece em "Convites pendentes".
- [ ] Logar (outra conta) com esse e-mail → entra **direto**, sem passar por aprovação.
- [ ] Convidar `x@a.com` mas logar com `y@b.com` → cai em "Entraram sem convite" (rede de segurança).

### Auto-cadastro (formulário)
- [ ] "Solicitar entrada" envia sem erro → aparece em "Pediram para entrar".
- [ ] Aprovar → vira "Convite pendente" → logar com o e-mail → entra.

### Login espontâneo
- [ ] Logar com conta nova sem convite → cai em **/aguardando**.
- [ ] Admin vê em "Entraram sem convite" → Aprovar → a pessoa **entra na hora** + recebe o aviso
      **"Bem-vindo!"** no sino.

---

## 💡 Sugestões de simplificação (decisão sua — não implementado)
1. ✅ **FEITO** — "Pediram para entrar" + "Entraram sem convite" agora são uma fila só ("Querem
   entrar"), cada item com etiqueta do tipo (pediu pelo formulário / já logou · aguardando).
2. **Aprovar sempre ativar direto** (hoje o Caminho 2 obriga a pessoa a logar de novo depois de
   aprovada; o Caminho 3 já ativa na hora — inconsistente).
3. **E-mail de convite (Fase 3B):** hoje o convite não avisa ninguém — a pessoa só entra se você
   mandar o link na mão. Com Resend, o convite manda o link automaticamente.
