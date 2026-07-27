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

## Depois: o template

1. Supabase → **Authentication** → **Emails** → aba **Templates** → **Magic Link**.
2. Em **Message body**, apagar o conteúdo e colar o HTML de `onboarding/supabase-magic-link.html`.
3. Em **Subject**, usar: `Sirvo — seu link de acesso`.
4. Salvar e testar pedindo um link em `/entrar`.

## Se não quiser mexer em SMTP agora

Dá pra deixar esse passo pra depois sem perder o essencial: a tela **"Confira seu email"** do `/entrar`
já mostra o botão "Ver os primeiros passos" logo depois de pedir o link. Quem pede login por e-mail vê
a demo na hora, na tela — só não recebe o link dentro do e-mail do Supabase.

O template já vem com a mesma cara dos outros e-mails do Sirvo e com o link
"Primeira vez? Veja como funciona" apontando para a demo.

## Atenção ao domínio

O arquivo aponta para `https://aliancapp.vercel.app/primeiros-passos.html`. É a URL de produção —
o template do Supabase é global (não tem preview por branch), então o link fixo é o certo aqui.
Se o domínio mudar, trocar nesse template também.

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
