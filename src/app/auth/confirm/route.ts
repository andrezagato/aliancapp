import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { registrarFalha } from "@/lib/failure-log";

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
// OS TRÊS QUE UM TEMPLATE DE LOGIN POR E-MAIL PODE EMITIR — e nenhum a mais.
//
// Ficam DE FORA de propósito: `recovery` (o `generateLink` da rota de convite
// grava em `recovery_token`, então aceitá-lo aqui daria um segundo caminho pra
// mesma credencial), `invite` (um "Invite user" do painel viraria sessão sem
// passar por convite nenhum) e `email_change` — este último MUTA a conta,
// confirmando a troca de endereço, como efeito colateral de algo que a rota
// chama de "login".
//
// `email` está aqui porque é o `type` do template PADRÃO do Supabase, que a
// documentação usa no exemplo. Os nossos dois emitem `magiclink` e `signup`
// (medido: um e-mail real de 23/08 chegou com `type=signup`), mas os templates
// que valem moram no painel, não no repo — e um `type` fora da lista não
// degrada: ele MATA o login por e-mail de todo mundo. Cobrir a terceira forma
// plausível custa nada e tira o risco de uma leitura que ninguém pode fazer
// daqui.
const TIPOS: readonly EmailOtpType[] = ["magiclink", "signup", "email"];

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
    // O `type` vem da URL e é escolhido por quem monta o link — ele NÃO entra
    // cru no detail, senão texto de estranho aterrissa no e-mail que o admin
    // lê como confiável ("Falha conhecida — ligue para o suporte…"). O valor só
    // acompanha quando parece de verdade com um type.
    const tipoSeguro = /^[a-z_]{1,32}$/.test(tipoBruto ?? "") ? tipoBruto : "(fora do formato)";
    await registrarFalha({
      kind: "login_link",
      detail: tokenHash ? `type inesperado: ${tipoSeguro}` : "link sem token_hash",
      origem: "/auth/confirm",
    });
    return recusa("invalido");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

  if (error) {
    // O prazo do link é do Supabase (1h). Separar o vencido do quebrado importa:
    // "já venceu, peça outro" é uma instrução; "não consegui" é um beco.
    const venceu = /expired|invalid/i.test(error.message);
    console.error("[confirm] verifyOtp falhou:", error.message);
    // AGUARDADO, não `void`: numa função da Vercel a instância pode ser congelada
    // quando a resposta sai, e sob tráfego baixo a promise pendurada some. Ver
    // src/lib/failure-log.ts.
    await registrarFalha({ kind: "login_link", detail: error.message, origem: "/auth/confirm" });
    return recusa(venceu ? "expirado" : "falhou");
  }

  // /inicio: o layout de (app) decide entre a home e /aguardando conforme o
  // status do perfil, que é onde essa decisão já mora.
  return NextResponse.redirect(`${origin}${next}`);
}
