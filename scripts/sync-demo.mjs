// Copia a demo "Primeiros passos" do export do Claude Design para `public/`,
// reaplicando os ajustes de <head> que o export não traz.
//
//   npm run demo:sync
//
// Sem o <meta viewport> a página abre com 980px de largura no celular e a
// animação fica ilegível — é o motivo de existir este script em vez de um "ctrl+C
// ctrl+V", que já esqueceria o passo na primeira vez.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "onboarding/export/primeiros-passos.html";
const DST = "public/primeiros-passos.html";

// O parâmetro `appUrl` da demo (botão "Abrir o app", último slide) vem do Claude
// Design com o repositório no GitHub como default. Apontar pra raiz do app: ela
// já roteia sozinha — sem sessão vai pro login, logado vai pro início.
const APP_URL = "https://aliancapp.vercel.app";
const DEFAULT_ERRADO = "https://github.com/andrezagato/aliancapp";

const HEAD = `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#6E1122">
  <meta name="robots" content="noindex">`;

if (!existsSync(SRC)) {
  console.error(`✗ Não achei ${SRC}.`);
  console.error("  Gere o export a partir de 'onboarding/Primeiros Passos.dc.html' antes de rodar.");
  process.exit(1);
}

let html = readFileSync(SRC, "utf8");

html = html.replace("<html>", '<html lang="pt-BR">');
html = html.replace(/<title>[^<]*<\/title>/, "<title>Sirvo — Primeiros passos</title>");
html = html.replace('<meta charset="utf-8">', HEAD);
html = html.replaceAll(DEFAULT_ERRADO, APP_URL);

// Trava de segurança: se o formato do export mudar e algum replace não pegar,
// é melhor falhar aqui do que publicar uma página quebrada no celular.
const faltando = [
  ['name="viewport"', "meta viewport"],
  ["<title>Sirvo — Primeiros passos</title>", "title"],
  ['lang="pt-BR"', "lang no <html>"],
].filter(([needle]) => !html.includes(needle));

if (faltando.length > 0) {
  console.error("✗ O export mudou de formato — estes ajustes não foram aplicados:");
  for (const [, nome] of faltando) console.error(`  - ${nome}`);
  console.error("  Ajuste scripts/sync-demo.mjs antes de publicar.");
  process.exit(1);
}

if (/(src|href)="https?:\/\//.test(html)) {
  console.error("✗ O export virou dependente de asset externo (http). Ele precisa ser autocontido.");
  process.exit(1);
}

// O botão "Abrir o app" mandava o voluntário pro GitHub. Se sobrar qualquer link
// pro repositório, é porque o default voltou e o replace acima não pegou.
if (html.includes("github.com")) {
  console.error("✗ Ainda há link pro GitHub no export — o botão 'Abrir o app' mandaria o");
  console.error("  voluntário pro repositório. Confira o parâmetro `appUrl` da demo.");
  process.exit(1);
}
if (!html.includes(APP_URL)) {
  console.error(`✗ Não achei ${APP_URL} no resultado — o botão "Abrir o app" não vai a lugar nenhum.`);
  process.exit(1);
}

writeFileSync(DST, html);
console.log(`✓ ${DST} atualizado (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
