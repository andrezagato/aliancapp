import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Rotas públicas (não exigem login). O resto exige sessão.
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/entrar") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/auth")
  );
}

/**
 * Renova a sessão do Supabase (padrão @supabase/ssr) E aplica o gate de auth:
 * - sem sessão + rota protegida  -> /entrar
 * - com sessão + tela de login   -> /inicio
 * A separação ativo/pendente (fila de aprovação) é feita no layout de (app),
 * que já carrega o profile — evita uma query de profile aqui no edge.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (!configured) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    return NextResponse.redirect(url);
  }

  if (user && (pathname.startsWith("/entrar") || pathname.startsWith("/cadastro"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // `.html` de fora: a demo `/primeiros-passos.html` é aberta por quem ainda
    // não tem login (convidado no e-mail) — não pode cair no gate de sessão.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
