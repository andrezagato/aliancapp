import "server-only";

import webpush from "web-push";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient<Database>(url, key, { auth: { persistSession: false } });
}

export async function sendPushToUser(recipientId: string, payload: PushPayload): Promise<void> {
  try {
    if (!configureVapid()) return;
    const db = adminClient();
    if (!db) return;
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", recipientId);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          // 404/410 = subscription expirada/removida → limpa.
          if (code === 404 || code === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }),
    );
  } catch {
    /* push é best-effort */
  }
}
