import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * O LINK DE LOGIN DO E-MAIL — ABERTO DE QUALQUER NAVEGADOR.
 *
 * POR QUE ESTA ROTA EXISTE. O `/auth/callback` faz `exchangeCodeForSession`, que
 * é PKCE: o `code` do link só vale junto com um `code_verifier` que ficou
 * guardado NO NAVEGADOR QUE PEDIU o link. Isso funciona no Google (o provedor
 * devolve a pessoa pro mesmo navegador que saiu) e quebra no link de e-mail, que
 * quase nunca abre onde foi pedido: o app do Gmail abre no webview dele, o
 * Outlook no dele. Sem o verifier, o GoTrue responde
 * `400: both auth code and code verifier should be non-empty`, a pessoa é jogada
 * de volta em `/entrar` e o que ela vê é a tela de login piscando — "não
 * aconteceu nada".
 *
 * Medido em produção em 21/08/2026: a Verônica pediu link às 19:02 e às 19:20 e
 * levou esse 400 nas duas; entrou às 19:21 pelo Google. Ela não tinha problema
 * de acesso nenhum — o link é que não abria fora do navegador de origem.
 *
 * `verifyOtp({ token_hash })` não tem esse laço: o token JÁ é a credencial, e a
 * troca acontece AQUI NO SERVIDOR. Qualquer navegador serve, inclusive um que
 * nunca viu este app. É o mesmo mecanismo que a `/auth/entrar/[token]` (o link
 * do convite) já usa em produção desde 16/08 — esta rota só estende pro link de
 * login o que já valia pro de convite.
 *
 * O `type` vem na URL porque o GoTrue usa DOIS templates conforme a conta já
 * exista ou não — `magiclink` pra quem tem conta, `signup` pra quem não tem — e
 * o token de cada um mora numa coluna diferente. Chutar um literal fixo derruba
 * metade dos logins. Ver `onboarding/PASSO-MANUAL-SUPABASE.md`: os dois
 * templates precisam apontar pra cá.
 */
export const dynamic = "force-dynamic";

/**
 * Lista fechada. `type` vem da URL, e ele decide qual coluna de token o GoTrue
 * consulta — deixar passar string arbitrária é entregar esse controle a quem
 * monta o link.
 */
const TIPOS: readonly EmailOtpType[] = ["magiclink", "signup", "email", "recovery", "invite", "email_change"];

/**
 * `next` volta a ser um caminho DESTE app, nunca um destino livre: sem isto,
 * `/auth/confirm?next=https://sitedele.com` viraria um redirecionador com o selo
 * do Sirvo — e ainda por cima logo depois de abrir a sessão. `//` é barrado
 * junto com `http://` porque `//host` também sai do domínio.
 */
function destinoSeguro(bruto: string | null): string {
  if (!bruto || !bruto.startsWith("/") || bruto.startsWith("//")) return "/inicio";
  return bruto;
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipoBruto = searchParams.get("type");
  const next = destinoSeguro(searchParams.get("next"));

  // Nenhuma recusa é beco sem saída: todas caem no campo de e-mail de /entrar,
  // que resolve. Mesma escolha da /auth/entrar/[token].
  const recusa = (motivo: string) => NextResponse.redirect(`${origin}/entrar?link=${motivo}`);

  const tipo = TIPOS.find((t) => t === tipoBruto);
  if (!tokenHash || !tipo) {
    console.error("[confirm] link sem token_hash ou com type inesperado:", tipoBruto);
    return recusa("invalido");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

  if (error) {
    // O prazo do link é do Supabase (1h). Separar o vencido do quebrado importa:
    // "já venceu, peça outro" é uma instrução; "não consegui" é um beco.
    const venceu = /expired|invalid/i.test(error.message);
    console.error("[confirm] verifyOtp falhou:", error.message);
    return recusa(venceu ? "expirado" : "falhou");
  }

  // /inicio: o layout de (app) decide entre a home e /aguardando conforme o
  // status do perfil, que é onde essa decisão já mora.
  return NextResponse.redirect(`${origin}${next}`);
}
