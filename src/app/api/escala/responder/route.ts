import { NextResponse } from "next/server";
import { confirmarEscalacao } from "@/lib/actions";

/**
 * "Confirmo" em 1 toque, direto da notificação — o service worker chama isto sem
 * abrir o app (o cookie de sessão vai no fetch, então a RLS continua sendo a dona
 * da permissão: a RPC por baixo só deixa a própria pessoa confirmar a própria
 * escala).
 *
 * Chama a MESMA action do app de propósito: assim o líder recebe o aviso de
 * "presença confirmada", a atividade é registrada e as conquistas sincronizam
 * igual ao caminho normal. Duas portas com comportamentos diferentes seria bug
 * esperando pra acontecer.
 *
 * Só CONFIRMA. Recusar exige um motivo de 3+ letras (é o que deixa o líder
 * remanejar) e isso não cabe num botão de notificação — nesse caso o SW abre o
 * app já na pergunta.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let assignmentId: string | undefined;
  try {
    const body = (await request.json()) as { assignmentId?: string };
    assignmentId = body.assignmentId;
  } catch {
    return NextResponse.json({ ok: false, erro: "corpo inválido" }, { status: 400 });
  }
  if (!assignmentId) {
    return NextResponse.json({ ok: false, erro: "assignmentId ausente" }, { status: 400 });
  }

  const r = await confirmarEscalacao(assignmentId);
  if (!r.ok) {
    // "Sessão expirada" vira 401 pro SW saber que precisa abrir o app pra logar
    const status = r.error?.toLowerCase().includes("sessão") ? 401 : 400;
    return NextResponse.json({ ok: false, erro: r.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
