import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Registra um evento no `activity_log` (append-only, via RPC security definer).
 * Best-effort — nunca derruba a ação principal. Serve pra alimentar relatórios
 * futuros (cancelamentos, trocas, atrasos, feedback…) sem depender de tabelas
 * mutáveis que perdem histórico (ex.: recusa apagada quando a vaga reabre).
 */
export async function logActivity(input: {
  profileId: string | null;
  actorId: string | null;
  kind: string;
  eventId?: string | null;
  teamId?: string | null;
  meta?: Json;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_activity", {
      p_profile: input.profileId as string,
      p_actor: input.actorId as string,
      p_kind: input.kind,
      p_event: input.eventId ?? undefined,
      p_team: input.teamId ?? undefined,
      p_meta: input.meta ?? {},
    });
  } catch {
    /* log é bônus — silencioso */
  }
}
