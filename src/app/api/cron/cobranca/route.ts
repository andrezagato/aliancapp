import { NextResponse } from "next/server";
import { rodarCobranca } from "@/lib/cobranca";
import { registrarFalha } from "@/lib/failure-log";

/**
 * Cobrança diária da escala (ver src/lib/cobranca.ts).
 *
 * Chamada pelo Vercel Cron (vercel.json, 15:00 UTC = meio-dia em São Paulo). A
 * Vercel manda `Authorization: Bearer $CRON_SECRET` automaticamente quando a env
 * existe — sem ela, a rota fica FECHADA em produção, porque uma URL adivinhável
 * que dispara push pra igreja toda não pode ficar aberta.
 *
 * `?dry=1` computa e devolve o que faria, sem enviar nem gravar nada. É assim
 * que se testa isto sem cobrar gente de verdade.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const viaQuery = url.searchParams.get("key");

  if (!secret) {
    return NextResponse.json(
      { erro: "CRON_SECRET não configurada — a cobrança fica desligada até existir." },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${secret}` && viaQuery !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const dry = url.searchParams.get("dry") === "1";
  try {
    const resumo = await rodarCobranca({ dry });
    return NextResponse.json(resumo);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha desconhecida";
    // Este 500 ia pro log da Vercel e morria lá. A cobrança já passou 3 dias
    // sem rodar (31/jul–03/ago) sem ninguém notar — agora a falha aparece no
    // digest da manhã seguinte.
    await registrarFalha({ kind: "cron", detail: msg, origem: "/api/cron/cobranca" });
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
