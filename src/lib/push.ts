import "server-only";

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

/**
 * Envio de Web Push (WS2.1). Best-effort: nunca lança — um push que falha não
 * pode derrubar a ação principal (é ligado no notify()).
 *
 * Usa a service-role key porque precisa LER as push_subscriptions do
 * DESTINATÁRIO (a RLS `push_all` só deixa cada um ver as próprias). É server-only.
 */

type PushPayload = { title: string; body?: string; url?: string; tag?: string };

let vapidReady = false;
function configureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@aliancapp.vercel.app",
    pub,
    priv,
  );
  vapidReady = true;
  return true;
}

export async function sendPushToUser(recipientId: string, payload: PushPayload): Promise<void> {
  try {
    if (!configureVapid()) return;
    const supabase = await createClient();
    // RPC SECURITY DEFINER: lê as subs do destinatário (a RLS não deixaria o
    // remetente ver as de outra pessoa). Só admin/líder pode chamar.
    const { data: subs } = await supabase.rpc("get_push_subs", { p_profile: recipientId });
    if (!subs || subs.length === 0) return;
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch {
          /* 404/410 (expirada) e afins — best-effort, ignora */
        }
      }),
    );
  } catch {
    /* push é best-effort */
  }
}
