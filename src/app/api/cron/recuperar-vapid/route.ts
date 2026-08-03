import { NextResponse } from "next/server";

/**
 * ⚠️ ROTA TEMPORÁRIA — APAGAR DEPOIS DE USAR (03/ago/2026).
 *
 * O painel da Vercel marcou `VAPID_PRIVATE_KEY` como "Sensitive", que é uma via
 * de mão única: o valor não volta nem pelo painel nem pelo `vercel env pull`. Só
 * que o RUNTIME recebe a env injetada — então o próprio app é o único lugar de
 * onde a chave ainda pode ser lida.
 *
 * Perder essa chave não é perder o push de hoje (o deployment em execução tem a
 * env): é ficar sem poder testar push fora de produção e, pior, a um `delete`
 * acidental de matar as inscrições de todos — porque `push-setup.tsx` só assina
 * o pushManager no clique e quem já concedeu permissão nunca reassina.
 *
 * Protegida por CRON_SECRET e com `no-store` pra não ficar em cache de CDN. O
 * segredo viaja na query, que a Vercel registra no log de requisição — então
 * troque o CRON_SECRET depois de usar isto.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ erro: "CRON_SECRET não configurada" }, { status: 503 });
  }
  if (url.searchParams.get("key") !== secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const corpo = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? null,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT ?? null,
    aviso: "Salve no cofre e no .env.local. Depois avise pra esta rota ser removida.",
  };

  return NextResponse.json(corpo, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
