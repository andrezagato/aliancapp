import "server-only";

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

/**
 * Envio de Web Push (WS2.1). Best-effort. Instrumentado temporariamente:
 * grava um diagnóstico em activity_log (kind='push_debug') pra achar a falha.
 */

type PushPayload = { title: string; body?: string; url?: string; tag?: string };

function configureVapid(): { ok: boolean; reason?: string } {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub) return { ok: false, reason: "no-public-key" };
  if (!priv) return { ok: false, reason: "no-private-key" };
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@aliancapp.vercel.app", pub, priv);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "setVapid:" + ((e as Error)?.message ?? String(e)) };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logDiag(supabase: any, recipientId: string, diag: unknown) {
  try {
    await supabase.rpc("log_activity", {
      p_profile: recipientId,
      p_actor: recipientId,
      p_kind: "push_debug",
      p_meta: diag,
    });
  } catch {
    /* ignora */
  }
}

export async function sendPushToUser(recipientId: string, payload: PushPayload): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diag: any = {};
  try {
    const v = configureVapid();
    diag.vapid = v.ok ? "ok" : v.reason;
    if (!v.ok) {
      await logDiag(supabase, recipientId, diag);
      return;
    }
    const { data: subs, error } = await supabase.rpc("get_push_subs", { p_profile: recipientId });
    diag.rpcError = error?.message ?? null;
    diag.subs = subs?.length ?? 0;
    if (!subs || subs.length === 0) {
      await logDiag(supabase, recipientId, diag);
      return;
    }
    diag.results = [];
    for (const s of subs) {
      try {
        const res = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        diag.results.push({ ok: res.statusCode });
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        diag.results.push({ err: err?.statusCode ?? err?.message ?? String(e), body: err?.body });
      }
    }
    await logDiag(supabase, recipientId, diag);
  } catch (e) {
    diag.fatal = (e as Error)?.message ?? String(e);
    await logDiag(supabase, recipientId, diag);
  }
}
