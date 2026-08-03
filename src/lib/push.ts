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
let avisouVapid = false;
/** Erro de CONFIGURAÇÃO grita; erro de rede é que fica quieto (ver abaixo). */
function avisar(motivo: string): false {
  if (!avisouVapid) {
    avisouVapid = true;
    console.warn(`[push] ${motivo} — nenhum push será enviado.`);
  }
  return false;
}

function configureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  // Faltar chave não é intermitência: é ambiente mal configurado, e em 03/ago
  // isso custou uma investigação inteira porque o `return false` era mudo — o
  // push simplesmente não saía e nada no log dizia por quê.
  if (!pub || !priv) {
    return avisar(
      `VAPID ausente (${!pub ? "NEXT_PUBLIC_VAPID_PUBLIC_KEY" : "VAPID_PRIVATE_KEY"})`,
    );
  }
  // web-push exige subject mailto: ou https:. Normaliza e-mail cru / valor inválido.
  let subject = (process.env.VAPID_SUBJECT || "").trim();
  if (!/^(mailto:|https?:)/i.test(subject)) {
    subject = subject.includes("@") ? `mailto:${subject}` : "mailto:contato@aliancapp.vercel.app";
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidReady = true;
    return true;
  } catch (e) {
    return avisar(`VAPID inválida: ${e instanceof Error ? e.message : "erro desconhecido"}`);
  }
}

/**
 * Dispara um push para uma lista de subs já resolvidas. Best-effort: configura
 * o VAPID e faz o loop `sendNotification` com try/catch por sub (uma expirada
 * não derruba as outras). Reutilizado pelo chat, que resolve as subs via RPC.
 *
 * Devolve os endpoints que o serviço de push declarou MORTOS (404/410). Quem
 * tiver permissão de apagar aproveita; quem não tiver pode ignorar o retorno.
 */
export async function sendPushToSubs(subs: PushSub[], payload: PushPayload): Promise<string[]> {
  const mortos: string[] = [];
  try {
    if (!configureVapid()) return mortos;
    if (!subs || subs.length === 0) return mortos;
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (e) {
          // 404/410 = o serviço de push garante que esta inscrição não existe
          // mais. Guardar a linha só faz o próximo envio repetir o erro pra
          // sempre. Outros status (403 de chave trocada, 5xx, timeout) podem ser
          // transitórios ou consertáveis pelo cliente — esses ficam.
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) mortos.push(s.endpoint);
        }
      }),
    );
  } catch {
    /* push é best-effort */
  }
  return mortos;
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
    const mortos = await sendPushToSubs(data ?? [], payload);
    // Só aqui dá pra limpar: a RLS de `push_subscriptions` exige
    // `profile_id = auth.uid()`, então o caminho com sessão (sendPushToUser)
    // não pode apagar a inscrição de OUTRA pessoa. Com service-role, pode — e é
    // o que impede o cron de bater no mesmo endpoint morto todo dia.
    if (mortos.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", mortos);
    }
  } catch {
    /* push é best-effort */
  }
}
