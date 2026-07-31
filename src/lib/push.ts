import "server-only";

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envio de Web Push (WS2.1). Best-effort: nunca lança — um push que falha não
 * derruba a ação principal (é ligado no notify()). Lê as subs do destinatário
 * via RPC SECURITY DEFINER get_push_subs (a RLS não deixaria ver as de outro).
 */

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

type PushSub = { endpoint: string; p256dh: string; auth: string };

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

/**
 * Dispara um push para uma lista de subs já resolvidas. Best-effort: configura
 * o VAPID e faz o loop `sendNotification` com try/catch por sub (uma expirada
 * não derruba as outras). Reutilizado pelo chat, que resolve as subs via RPC.
 */
export async function sendPushToSubs(subs: PushSub[], payload: PushPayload): Promise<void> {
  try {
    if (!configureVapid()) return;
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

export async function sendPushToUser(recipientId: string, payload: PushPayload): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: subs } = await supabase.rpc("get_push_subs", { p_profile: recipientId });
    await sendPushToSubs(subs ?? [], payload);
  } catch {
    /* push é best-effort */
  }
}

/**
 * Igual ao de cima, mas lendo as subs com SERVICE-ROLE — pra quem roda sem
 * usuário logado (o cron da cobrança). A RPC `get_push_subs` depende de
 * `auth.uid()` e devolveria vazio nesse contexto.
 */
export async function sendPushToUserAsAdmin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  recipientId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const { data } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", recipientId);
    await sendPushToSubs(data ?? [], payload);
  } catch {
    /* push é best-effort */
  }
}
