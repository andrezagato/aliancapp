import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarFalha } from "@/lib/failure-log";

/**
 * Troca o "code" do OAuth por uma sessão e redireciona pro app.
 *
 * É PKCE, e isso é o certo AQUI: o Google devolve a pessoa pro mesmo navegador
 * de onde ela saiu, então o `code_verifier` está no lugar. O link de e-mail NÃO
 * passa mais por aqui justamente porque lá essa premissa é falsa — ele vai pra
 * /auth/confirm, que troca por `token_hash` no servidor.
 *
 * O `registrarFalha` existe por causa de 21/08: a Verônica bateu neste `else`
 * duas vezes, a tela piscou pra /entrar, e o app não guardou nada. A causa
 * (`code verifier should be non-empty`) só apareceu porque os logs do Supabase
 * ainda não tinham expirado — eles duram 24h, e o relato dela levou dias.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/inicio";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    void registrarFalha({ kind: "login_link", detail: error.message, origem: "/auth/callback" });
  } else {
    void registrarFalha({
      kind: "login_link",
      detail: "chegou em /auth/callback sem `code` na URL",
      origem: "/auth/callback",
    });
  }

  return NextResponse.redirect(`${origin}/entrar?erro=auth`);
}
