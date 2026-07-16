# E-mail (Resend) — o que preparar (Fase 3B)

Pra ligar o envio de e-mail (convite + avisos críticos que garantem no iPhone), preciso que você
faça esses passos e me traga 3 coisas. Não precisa mexer em código — é só conta + chave.

## Passo a passo (você faz)
1. **Criar conta grátis** em https://resend.com.
2. **Remetente ("from"):** duas opções —
   - **Teste rápido:** usar `onboarding@resend.dev` (já vem pronto, **mas só envia pro e-mail com que você criou a conta** — bom pra testar comigo).
   - **Pra valer:** em **Domains**, adicionar um domínio seu e seguir os registros DNS que o Resend mostra (SPF/DKIM). Aí o "from" vira algo como `Sirvo <avisos@seudominio.com>` e envia pra qualquer pessoa.
3. **Criar a API key:** Resend → **API Keys → Create** → copiar (começa com `re_...`).

## O que me trazer amanhã
- [ ] **`RESEND_API_KEY`** (a chave `re_...`).
- [ ] **Endereço "from"** que vou usar (`onboarding@resend.dev` pra teste, ou `algo@seudominio.com` se verificou domínio).
- [ ] Se verificou domínio: confirma qual (só pra eu conferir).

## O que eu faço com isso
- Adiciono `RESEND_API_KEY` como env var (você cola no painel da Vercel em Production+Preview; eu te digo onde).
- Envio por e-mail: **convite** (com o link do app — resolve o "convite não avisa ninguém"),
  **escalado** e **evento alterado** (canais garantidos no iPhone).
- Respeito as preferências de canal por pessoa (tabela `notification_prefs`) quando entrarmos nisso.

> Enquanto não fizermos isso, o sino (in-app) já funciona; o e-mail é o complemento pra quem não
> abre o app com frequência e pro convite chegar sozinho.
