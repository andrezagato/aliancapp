# Integrar a demo "Primeiros Passos" ao e-mail de convite

A demo é uma página interativa (HTML + animação). **E-mail não roda isso dentro dele** — clientes de
e-mail bloqueiam script. O caminho é: **hospedar a página no próprio app** e o e-mail leva um botão
pra ela. Um clique, abre no celular, roda sozinha.

## 1. Hospedar dentro do app (2 min, sem build)

O arquivo `export/primeiros-passos.html` é autocontido (nenhum asset externo). No repo `aliancapp`:

```
public/primeiros-passos.html
```

Só copiar pra lá. O Next serve `public/` como estático, então a URL fica:

```
https://SEU-DOMINIO/primeiros-passos.html
```

Nada de rota, layout ou auth — funciona pra quem ainda não tem login (é o caso do convidado).

## 2. Botão no e-mail de convite

Em `src/lib/email.ts`, o `layout()` já aceita um CTA. Adicione um **link secundário** logo abaixo do
botão principal — sem quebrar o padrão atual:

No `layout()`, aceite um segundo CTA:

```ts
function layout(opts: {
  title: string;
  intro: string;
  cta?: { label: string; href: string };
  secondary?: { label: string; href: string };   // <— novo
  footer?: string;
}): string {
  const { title, intro, cta, secondary, footer } = opts;
```

e depois do bloco do `cta`, injete:

```ts
${
  secondary
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#374151;">
         Primeira vez? <a href="${secondary.href}" style="color:#111827;font-weight:600;">${esc(secondary.label)}</a>
         — 1 minuto, mostra como entrar, confirmar sua escala e acompanhar o culto.
       </p>`
    : ""
}
```

E no `conviteEmail()`:

```ts
cta: { label: "Entrar no Sirvo", href: opts.href },
secondary: { label: "veja como funciona", href: `${siteUrl()}/primeiros-passos.html` },
```

> `siteUrl()` já existe no arquivo e resolve o domínio de produção na Vercel.

Vale colocar o mesmo link secundário no `escaladoEmail()` para quem foi escalado antes de abrir o app
pela primeira vez.

## 3. Onde mais usar o mesmo link

- **WhatsApp:** hoje o convite vai na mão (ONBOARDING.md, Caminho 1) — mandar o link da demo junto.
- **Tela `/aguardando`:** quem entrou e espera aprovação fica sem nada pra fazer; um botão
  "Veja como funciona" segura a pessoa.
- **`/cadastro`:** um link no rodapé do formulário.

## Se você quiser um GIF no corpo do e-mail

Dá pra gravar a sequência e virar GIF/MP4 (Gmail e Apple Mail mostram GIF; Outlook mostra só o
primeiro quadro). Serve como chamariz, mas o link continua sendo necessário — me pede que eu gravo.

## Atualizar a demo depois

A fonte é `Primeiros Passos.dc.html`. Ao mudar algo, é preciso gerar de novo o
`export/primeiros-passos.html` e recopiar pro `public/` — me avisa e eu faço.
