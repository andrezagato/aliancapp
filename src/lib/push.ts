import "server-only";

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

/**
 * Envio de Web Push (WS2.1). Best-effort: nunca lança — um push que falha não
 * derruba a ação principal (é ligado no notify()). Lê as subs do destinatário
 * via RPC SECURITY DEFINER get_push_subs (a RLS não deixaria ver as de outro).
 */

type PushPayload = { title: string; body?: string; url?: string; tag?: string };

let vapidReady = false;
function configureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  // web-push exige subject mailto: ou https:. Normaliza e-mail cru / valor inválido.
  let subject = (process.env.VAPID_SUBJECT || "").trim();
  if (!/^(mailto:|https?:)/i.test(subject)) {
    subject = subject.includes("@") ? `mailto:${subject}` : "mailto:contato@aliancapp.vercel.app";
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidReady = true;
    return true;
  } catch {
    return false;
  }
}

export async function sendPushToUser(recipientId: string, payload: PushPayload): Promise<void> {
  try {
    if (!configureVapid()) return;
    const supabase = await createClient();
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
