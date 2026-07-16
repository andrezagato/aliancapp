import "server-only";

import { createClient } from "@/lib/supabase/server";
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
};

/**
 * Cria um aviso in-app (sino) para OUTRA pessoa via RPC `notificar`
 * (SECURITY DEFINER — a criação pra terceiros não passa pela RLS de recipient).
 * Best-effort: um aviso que falha NÃO derruba a ação principal.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (!input.recipientId) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("notificar", {
      p_recipient: input.recipientId,
      p_kind: input.kind,
      p_title: input.title,
      p_body: input.body,
      p_link: input.link,
      p_team: input.teamId ?? undefined,
      p_event: input.eventId ?? undefined,
    });
  } catch {
    /* silencioso de propósito */
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
