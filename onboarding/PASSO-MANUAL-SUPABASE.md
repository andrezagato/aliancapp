# Passo manual: e-mail de "link de acesso" (magic link)

Os e-mails que **o app** manda (convite do admin, escalação, lembrete) já saem com o link da demo —
isso está no código, em `src/lib/email.ts`.

O e-mail de **login por link** (`/entrar` → "Receber link de acesso") **não passa pelo nosso código**:
quem envia é o Supabase Auth, com um template guardado no painel deles. Por isso esse é o único
ponto que precisa ser feito na mão, uma vez só.

## Antes: o Supabase exige SMTP próprio

O painel só libera template customizado se houver **custom SMTP** configurado. O serviço de e-mail
embutido do Supabase é só pra desenvolvimento (poucos e-mails por hora) — de todo jeito não serviria
pra convite de voluntário.

Não precisa de provedor novo: **o app já usa Resend**, e o Resend tem SMTP. É a mesma conta e o mesmo
domínio verificado dos outros e-mails do Sirvo.

Em **Authentication → Emails → SMTP Settings**, ligar **Enable custom SMTP** e preencher:

| Campo | Valor |
| --- | --- |
| Sender email address | `avisos@ministerioalianca.com` |
| Sender name | `Sirvo na Aliança` |
| Host | `smtp.resend.com` |
| Port number | `465` |
| Minimum interval per user | `60` (deixar como está) |
| Username | `resend` — literal, é sempre essa palavra |
| Password | a `RESEND_API_KEY` (`re_...`), a mesma que já está na Vercel |

⚠️ Os dois primeiros campos saem da env `RESEND_FROM_EMAIL`, que na Vercel vale
`Sirvo na Aliança <avisos@ministerioalianca.com>`. **O Supabase separa nome e endereço em dois
campos** — colar o valor inteiro no "Sender email address" quebra o envio.

O domínio `ministerioalianca.com` já está verificado no Resend (é de onde os e-mails do app saem hoje),
então não há DNS a fazer. Se um dia o remetente voltar pra `onboarding@resend.dev`, aí sim o envio só
chega no dono da conta Resend e ninguém mais recebe.

Depois de salvar, conferir **Authentication → Rate Limits** → "Rate limit for sending emails": o padrão
(30/hora) é baixo pra um mutirão de convites.

## Depois: os templates — são DOIS, e os dois importam

O `/entrar` chama um `signInWithOtp` só, mas o GoTrue decide sozinho qual e-mail
mandar: **Magic Link** se o e-mail já tem conta, **Confirm signup** se não tem.
Mexer só no primeiro deixa quem está entrando pela primeira vez com o e-mail
errado — justamente quem menos tem paciência pra insistir.

| Template no painel | Colar este arquivo | Subject |
| --- | --- | --- |
| **Magic Link** | `onboarding/supabase-magic-link.html` | `Sirvo — seu link de acesso` |
| **Confirm signup** | `onboarding/supabase-confirm-signup.html` | `Sirvo — seu link de acesso` |

Supabase → **Authentication** → **Emails** → aba **Templates** → escolher o
template → em **Message body**, apagar o conteúdo e colar o HTML. Salvar e testar
pedindo um link em `/entrar`.

### Os dois templates agora trazem TAMBÉM o código digitável

Cada template imprime `{{ .Token }}` num bloco abaixo do botão. **Não é um
segredo novo**: `{{ .Token }}` e o `{{ .TokenHash }}` do link são a mesma
credencial em duas formas — um vai na URL, o outro vai nos olhos. Quem sempre
tocou no botão continua tocando; o código é caminho adicional, nunca substituto.

Por que ele existe: o botão abre no navegador que o app de e-mail escolher, e a
sessão nasce **lá**. Digitando o código em `/entrar`, a sessão nasce **na aba de
onde a pessoa pediu** — que é o único jeito de ela cair no lugar certo quando o
Sirvo estiver salvo como app na tela de início (o app tem jarro de cookie
próprio, separado do Safari).

**Tem que ser nos DOIS templates.** Quem ainda não tem conta recebe o *Confirm
signup*, não o *Magic Link* — e é justamente quem mais precisa do código.

Do lado do app, `/entrar` tenta `verifyOtp` com `type: "email"` e, se recusar,
com `type: "signup"` — porque daqui não dá pra saber qual dos dois e-mails o
GoTrue mandou, e o token de cada um mora numa coluna diferente.

**Quantos dígitos:** quem manda é **Authentication → Email OTP Length**, não o
código do app. Medido em 25/08 neste projeto: **8 dígitos** — e não 6, que é o
padrão da documentação e onde o campo do `/entrar` nasceu errado. Por isso o
campo aceita de 6 a 10 em vez de travar num número: mexer nessa configuração do
painel não pode derrubar o login. Se você mudar lá, não precisa mexer aqui.

### ⚠️ Rate Limits: são DOIS campos, e o segundo quase ninguém olha

**Authentication → Rate Limits**:

| Campo | Padrão | Por que importa |
| --- | --- | --- |
| *Rate limit for sending emails* | 30/hora | baixo pra um mutirão de convites |
| *Rate limit for sending OTPs* (`/auth/v1/otp`) | **30/hora, soma do PROJETO** | é o teto de quantas pessoas conseguem pedir link por hora — **no total**, não por pessoa. E não há limite por IP nem captcha |

O segundo é o que trava o login por e-mail de todo mundo se estourar. Vale
conferir o valor efetivo antes de qualquer mudança que aumente o número de
pedidos de link.

### ⚠️ Não volte o botão pra `{{ .ConfirmationURL }}`

É o padrão do Supabase e é uma armadilha aqui. Aquele link carrega um `code`
**PKCE**, que só vale junto com um `code_verifier` guardado **no navegador que
pediu o link**. Só que link de e-mail quase nunca abre onde foi pedido — o app do
Gmail abre no webview dele, o Outlook no dele. Sem o verifier o login morre com
`400: both auth code and code verifier should be non-empty`, e a pessoa é
devolvida pra tela de login sem entender o que houve. Ela diz "abri o link e não
apareceu nada", e está descrevendo exatamente o que viu.

Aconteceu em produção em 21/08/2026: duas tentativas seguidas, os dois 400. A
pessoa só entrou quando desistiu do link e usou o Google.

Por isso os dois templates apontam pra **`/auth/confirm?token_hash={{ .TokenHash }}&type=…`**:
ali o token JÁ é a credencial e a troca acontece no servidor, então qualquer
navegador serve. É o mesmo mecanismo que o link de convite
(`/auth/entrar/[token]`) usa desde 16/08. O `type` muda por template —
`magiclink` num, `signup` no outro — porque o token de cada um mora numa coluna
diferente no GoTrue; trocar os dois derruba o login.

O `{{ .ConfirmationURL }}` segue certo no **Google**, que é outro caminho
(`/auth/callback`): lá o provedor devolve a pessoa pro mesmo navegador de onde
ela saiu, então o PKCE fecha. Ninguém precisa mexer nisso.

## Se não quiser mexer em SMTP agora

Dá pra deixar esse passo pra depois sem perder o essencial: a tela **"Confira seu email"** do `/entrar`
já mostra o botão "Ver os primeiros passos" logo depois de pedir o link. Quem pede login por e-mail vê
a demo na hora, na tela — só não recebe o link dentro do e-mail do Supabase.

O template já vem com a mesma cara dos outros e-mails do Sirvo e com o link
"Primeira vez? Veja como funciona" apontando para a demo.

## Atenção ao domínio

Cada template tem **dois** links fixos em `https://sirvo.ministerioalianca.com`: o botão de entrar
(`/auth/confirm?…`) e o "Primeira vez? Veja como funciona" (`/primeiros-passos.html`). É a URL de
produção — o template do Supabase é global (não tem preview por branch), então o link fixo é o certo
aqui. **Se o domínio mudar, são 4 lugares** (2 links × 2 templates).

### ⚠️ `NEXT_PUBLIC_SITE_URL` SÓ VALE DEPOIS DE UM REDEPLOY

Variável `NEXT_PUBLIC_*` é **embutida no build** pelo Next. Trocar o valor no
painel da Vercel **não muda nada** no deploy que já está no ar — é preciso
**Redeploy** depois de salvar. Sem isso, os links gerados pelo código continuam
apontando pro domínio antigo enquanto os templates apontam pro novo, e aí você
tem o pior dos dois: metade dos links fora do domínio do remetente.

### ⚠️ O DOMÍNIO DO LINK TEM QUE BATER COM O DO REMETENTE

Isto não é preferência, é entregabilidade. Em 22/08/2026 um convite de teste caiu no **spam** do
Gmail, e o próprio painel do Resend apontou a causa:

> **Ensure link URLs match sending domain** — *"Mismatched URLs can trigger spam filters."*

O e-mail saía de `avisos@ministerioalianca.com` e **todos** os links apontavam pra
`aliancapp.vercel.app`. SPF e DKIM provam quem mandou; eles não dizem nada sobre pra onde o link
leva, e remetente de um domínio com link de outro é a forma clássica de phishing.

Isso explicava meses de "o convite não chegou" que tinham sido atribuídos a Hotmail agressivo e a
bug de código. Não era nem um nem outro.

**Consequência prática:** se um dia o app voltar pra um domínio diferente do remetente, o convite
volta pro spam. Ou se muda o domínio do app, ou se muda o remetente — os dois têm que ser a mesma
casa.

Não usar `{{ .SiteURL }}` pra economizar isso: ele vem do Site URL do painel, que é um campo que
ninguém olha há meses e que aponta pra `localhost` em muito projeto. Um link de login apontando pra
`localhost` não dá erro — ele simplesmente não abre pra ninguém, e você só descobre pelo relato.

## Atualizar a demo depois (nada a fazer agora)

Isto é só pra quando a animação mudar. Quando o Claude Design gerar um export novo em
`onboarding/export/primeiros-passos.html`, rodar:

```bash
npm run demo:sync
```

O script copia pro `public/` e reaplica os ajustes de `<head>` que o export não traz — o
`<meta viewport>` é o crítico: sem ele a página abre com 980px de largura no celular e a animação
fica ilegível. Se o formato do export mudar e algum ajuste não pegar, o script falha em vez de
publicar uma página quebrada.
