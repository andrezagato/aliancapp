import { NextResponse } from "next/server";
import { rodarDigest } from "@/lib/digest";
import { registrarFalha } from "@/lib/failure-log";

/**
 * Digest diário do administrador (ver src/lib/digest.ts).
 *
 * Chamado pelo Vercel Cron (vercel.json, 10:00 UTC = 07:00 em São Paulo — antes
 * do culto de domingo, que é quando um problema custa mais caro).
 *
 * Mesma proteção da cobrança: a Vercel manda `Authorization: Bearer $CRON_SECRET`
 * sozinha quando a env existe, e sem ela a rota fica FECHADA. Aqui o motivo é
 * diferente — o digest não dispara nada pra igreja, mas o CORPO dele lista
 * e-mails de gente travada, e URL adivinhável que devolve isso é vazamento.
 *
 * `?dry=1` computa e devolve os blocos sem mandar e-mail nenhum. É como se testa
 * isto sem encher a caixa de ninguém.
 *
 * IMPORTANTE — o middleware. A cobrança (0045) passou 3 dias sem rodar porque o
 * gate de sessão devolvia 307 pra /entrar antes da rota existir. `/api/cron` já
 * está na lista de públicas do `src/middleware.ts` por causa daquele incidente;
 * se um dia essa linha sumir, este digest morre junto e do mesmo jeito calado.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const viaQuery = url.searchParams.get("key");

  if (!secret) {
    return NextResponse.json(
      { erro: "CRON_SECRET não configurada — o digest fica desligado até existir." },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${secret}` && viaQuery !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const dry = url.searchParams.get("dry") === "1";
  try {
    const resumo = await rodarDigest({ dry });
    return NextResponse.json(resumo);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha desconhecida";
    // O vigia que morre calado é o pior de todos: sem esta linha, um digest
    // quebrado seria indistinguível de um digest que não tinha nada a dizer.
    void registrarFalha({ kind: "cron", detail: msg, origem: "/api/cron/digest" });
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
