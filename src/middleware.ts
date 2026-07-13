import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Renova a sessão do Supabase a cada request (padrão @supabase/ssr).
 * NOTE (Fase 1): aqui entrará o gate de autenticação por rota. No MVP inicial
 * as rotas do app renderizam em "modo demonstração" quando não há sessão.
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

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|gif|webp)$).*)",
  ],
};
