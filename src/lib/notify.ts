import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { comVia, registrarEntrega, type EntregaCtx } from "@/lib/delivery";
import type { Database } from "@/lib/supabase/database.types";

type Kind = Database["public"]["Enums"]["notification_kind"];

type NotifyInput = {
  recipientId: string | null | undefined;
  kind: Kind;
  title: string;
  body?: string;
  link?: string;
  teamId?: string | null;
  eventId?: string | null;
  /** Só pra telemetria: liga a entrega à escalação que ela cobra (0052). */
  assignmentId?: string | null;
};

/**
 * Cria um aviso in-app (sino) para OUTRA pessoa via RPC `notificar`
 * (SECURITY DEFINER — a criação pra terceiros não passa pela RLS de recipient).
 * Best-effort: um aviso que falha NÃO derruba a ação principal.
 */
/** Avisos que também disparam push no aparelho (o resto fica só no sino). */
const PUSH_KINDS = new Set<Kind>(["escalado", "lembrete", "evento_equipe"]);

/**
 * Preferência do DESTINATÁRIO (migration 0044). Vem por RPC SECURITY DEFINER
 * porque a RLS de `notification_prefs` só deixa cada um ler a própria linha — e
 * quem dispara o aviso é outra pessoa. Linha ausente = tudo ligado.
 */
export async function avisoPrefs(
  recipientId: string,
  kind: Kind,
): Promise<{ push: boolean; email: boolean; in_app: boolean }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("aviso_prefs", { p_recipient: recipientId, p_kind: kind });
    const row = Array.isArray(data) ? data[0] : data;
    return {
      push: row?.push ?? true,
      email: row?.email ?? true,
      in_app: row?.in_app ?? true,
    };
  } catch {
    return { push: true, email: true, in_app: true }; // na dúvida, avisa
  }
}

/** Filtra uma lista de destinatários pelos que aceitam e-mail desse assunto. */
export async function quemAceitaEmail(recipientIds: string[], kind: Kind): Promise<string[]> {
  const checks = await Promise.all(
    recipientIds.map(async (id) => ((await avisoPrefs(id, kind)).email ? id : null)),
  );
  return checks.filter((id): id is string => id !== null);
}

export async function notify(input: NotifyInput): Promise<void> {
  const recipientId = input.recipientId;
  if (!recipientId) return;

  // TELEMETRIA (0052): só os avisos de escala são medidos — são os que a
  // pergunta "a pessoa foi alcançada e respondeu?" trata. E a preferência do
  // destinatário já era buscada aqui pro push, então medir não acrescentou
  // nenhuma ida ao banco: é a MESMA chamada, agora aproveitada pelos dois canais.
  const medido = PUSH_KINDS.has(input.kind);
  const prefs = medido ? await avisoPrefs(recipientId, input.kind) : null;
  const ctx: EntregaCtx | null = medido
    ? {
        profileId: recipientId,
        kind: input.kind,
        eventId: input.eventId ?? null,
        assignmentId: input.assignmentId ?? null,
        teamId: input.teamId ?? null,
      }
    : null;

  try {
    const supabase = await createClient();
    // o sino é filtrado DENTRO do `notificar` (respeita in_app lá, com o
    // security definer que consegue ler a preferência do destinatário)
    await supabase.rpc("notificar", {
      p_recipient: recipientId,
      p_kind: input.kind,
      p_title: input.title,
      p_body: input.body,
      // cada canal carrega a própria origem no link: é assim que a resposta
      // volta atribuída ao canal que a provocou.
      p_link: comVia(input.link, "in_app"),
      p_team: input.teamId ?? undefined,
      p_event: input.eventId ?? undefined,
    });
  } catch {
    /* silencioso de propósito */
  }

  if (ctx && prefs) {
    await registrarEntrega({
      ...ctx,
      channel: "in_app",
      outcome: prefs.in_app ? "enviado" : "desligado",
    });
    // Push (best-effort, separado do sino) — só se a pessoa quer ser
    // interrompida no aparelho por esse assunto. Quem desligou vira
    // 'desligado', não 'sem_destino': é escolha dela, não falha nossa, e
    // misturar as duas faria o painel pedir suporte técnico pra quem só quer paz.
    if (prefs.push) {
      await sendPushToUser(
        recipientId,
        {
          title: input.title,
          body: input.body,
          url: comVia(input.link, "push"),
          tag: input.eventId ?? undefined,
        },
        ctx,
      );
    } else {
      await registrarEntrega({ ...ctx, channel: "push", outcome: "desligado" });
    }
  }
}

export async function notifyMany(
  recipientIds: (string | null | undefined)[],
  input: Omit<NotifyInput, "recipientId">,
): Promise<void> {
  const unique = [...new Set(recipientIds.filter(Boolean) as string[])];
  await Promise.all(unique.map((id) => notify({ ...input, recipientId: id })));
}

/** IDs dos líderes de uma equipe (pra rotear avisos por-equipe da §7). */
export async function teamLeaderIds(teamId: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("memberships")
      .select("profile_id")
      .eq("team_id", teamId)
      .eq("role", "leader");
    return (data ?? []).map((m) => m.profile_id);
  } catch {
    return [];
  }
}
