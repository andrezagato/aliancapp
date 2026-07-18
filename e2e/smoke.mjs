// Smoke test read-only da UI por perfil (Playwright + login de teste dev).
//
// Requisitos:
//   1) dev server rodando:  npm run dev
//   2) personas de teste no banco (@teste.local / teste123) — o login de teste
//      (dev) da tela /entrar só aparece em NODE_ENV=development.
//
// Uso:
//   npm run e2e                       # usa http://localhost:3000, joana + pedro
//   BASE_URL=http://localhost:3001 npm run e2e
//   E2E_LEADER=ana@teste.local E2E_VOLUNTEER=rafael@teste.local npm run e2e
//
// NÃO faz nenhuma ação que grava — só navega, confere e tira screenshots
// (em e2e/screenshots/, git-ignored). Sai com código 1 se alguma checagem falhar.

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PW = process.env.E2E_PASSWORD || "teste123";
const LEADER = process.env.E2E_LEADER || "joana@teste.local";
const VOL = process.env.E2E_VOLUNTEER || "pedro@teste.local";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "screenshots");
mkdirSync(DIR, { recursive: true });

let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + msg);
  if (!cond) failures++;
};

async function login(page, email) {
  await page.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000); // deixa React hidratar (senão o submit vira GET nativo)
  await page.locator("summary", { hasText: "Login de teste" }).click();
  await page.getByPlaceholder("joana@teste.local").fill(email);
  await page.getByPlaceholder("senha (teste123)").fill(PW);
  await page.getByRole("button", { name: "Entrar (dev)" }).click();
  await page.waitForURL("**/inicio", { timeout: 25000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();

// ---------------- LÍDER ----------------
console.log(`\nLÍDER (${LEADER})`);
{
  const ctx = await browser.newContext({ viewport: { width: 402, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await login(page, LEADER);
    await page.screenshot({ path: `${DIR}/lider-inicio.png`, fullPage: true });
    const nav = page.locator("nav");
    check((await nav.getByText("Cronograma").count()) > 0, "aba Cronograma no menu");
    check((await nav.getByText("Equipes").count()) > 0, "aba Equipes no menu");
    check((await nav.getByText("Livre?").count()) === 0, '"Livre?" removido do menu');
    check((await page.getByText("Dias que sua equipe serve").count()) > 0, "calendário da equipe presente");
    // abre o modal editável tocando num dia marcado do calendário
    const day = page.locator('section:has(h3:has-text("Dias que sua equipe serve")) button').first();
    if ((await day.count()) > 0) {
      await day.click();
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 8000 });
      await page.waitForTimeout(700);
      check(true, "modal do evento abre pelo calendário");
      await page.screenshot({ path: `${DIR}/lider-modal.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    // hub Equipes do líder
    await page.goto(`${BASE}/equipes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    check(
      (await page.getByText("MEMBROS").count()) > 0 || (await page.getByText("não lidera").count()) > 0,
      "hub Equipes do líder carrega",
    );
    await page.screenshot({ path: `${DIR}/lider-equipes.png`, fullPage: true });
  } catch (e) {
    check(false, "líder: " + e.message);
    await page.screenshot({ path: `${DIR}/lider-erro.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}

// ---------------- VOLUNTÁRIO ----------------
console.log(`\nVOLUNTÁRIO (${VOL})`);
{
  const ctx = await browser.newContext({ viewport: { width: 402, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await login(page, VOL);
    await page.screenshot({ path: `${DIR}/voluntario-inicio.png`, fullPage: true });
    await page.goto(`${BASE}/perfil`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    check((await page.getByText("Datas indisponíveis").count()) > 0, '"Datas indisponíveis" no Perfil');
    await page.screenshot({ path: `${DIR}/voluntario-perfil.png`, fullPage: true });
    await page.goto(`${BASE}/cronograma`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    check((await page.getByText("Em breve").count()) > 0, "Cronograma mostra placeholder");
    await page.screenshot({ path: `${DIR}/cronograma.png`, fullPage: true });
  } catch (e) {
    check(false, "voluntário: " + e.message);
    await page.screenshot({ path: `${DIR}/voluntario-erro.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${failures === 0 ? "OK — tudo passou" : failures + " checagem(ns) falharam"}. Screenshots em e2e/screenshots/`);
process.exit(failures === 0 ? 0 : 1);
