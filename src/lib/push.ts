import "server-only";

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  desfechoDoPush,
  marcaDoAparelho,
  registrarEntrega,
  registrarEntregaAdmin,
  type EntregaCtx,
} from "@/lib/delivery";
import type { DeliveryOutcome } from "@/lib/supabase/database.types";

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
 * Resultado de uma rodada de envio. Antes daqui só saía a lista de mortos, e
 * todo o resto morria no catch — era isso que tornava "o push funciona?" uma
 * pergunta sem resposta possível (migration 0052).
 */
export type PushResultado = {
  /** endpoints que o serviço de push declarou MORTOS (404/410) */
  mortos: string[];
  entregues: number;
  falhas: number;
  /** último status HTTP de erro visto — vira `detail` na telemetria */
  ultimoStatus?: number;
  /**
   * Nada foi TENTADO por problema nosso (VAPID ausente/inválida). Diferente de
   * "falhou": aqui o aparelho da pessoa está bom e o servidor está quebrado —
   * confundir os dois mandaria o líder cobrar a pessoa por um bug nosso.
   */
  impedido?: string;
};

/**
 * Dispara um push para uma lista de subs já resolvidas. Best-effort: configura
 * o VAPID e faz o loop `sendNotification` com try/catch por sub (uma expirada
 * não derruba as outras). Reutilizado pelo chat, que resolve as subs via RPC.
 *
 * Entre os retornos vão os endpoints que o serviço declarou MORTOS (404/410).
 * Quem tiver permissão de apagar aproveita; quem não tiver pode ignorar.
 */
export async function sendPushToSubs(
  subs: PushSub[],
  payload: PushPayload,
): Promise<PushResultado> {
  const r: PushResultado = { mortos: [], entregues: 0, falhas: 0 };
  try {
    // Sem destino vem ANTES da checagem de VAPID: quem não tem inscrição não
    // tem nada a ver com a configuração do servidor, e trocar a ordem faria
    // "ninguém instalou o app" aparecer como "o servidor está quebrado".
    if (!subs || subs.length === 0) return r;
    if (!configureVapid()) {
      r.impedido = "VAPID ausente ou inválida";
      return r;
    }
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
          r.entregues++;
        } catch (e) {
          // 404/410 = o serviço de push garante que esta inscrição não existe
          // mais. Guardar a linha só faz o próximo envio repetir o erro pra
          // sempre. Outros status (403 de chave trocada, 5xx, timeout) podem ser
          // transitórios ou consertáveis pelo cliente — esses ficam.
          const status = (e as { statusCode?: number }).statusCode;
          r.falhas++;
          if (status) r.ultimoStatus = status;
          if (status === 404 || status === 410) r.mortos.push(s.endpoint);
        }
      }),
    );
  } catch {
    /* push é best-effort */
  }
  return r;
}

/** Traduz o resultado bruto no par (desfecho, detalhe) que vai pro delivery_log. */
function telemetriaDoPush(
  r: PushResultado,
  subs: PushSub[],
): { outcome: DeliveryOutcome; detail: string | null; providerId: string | null } {
  const tentados = r.entregues + r.falhas;
  return {
    outcome: r.impedido ? "falhou" : desfechoDoPush(r),
    detail:
      r.impedido ??
      (r.falhas > 0
        ? `${r.entregues}/${tentados} aparelhos${r.ultimoStatus ? ` · erro ${r.ultimoStatus}` : ""}`
        : null),
    // Só identifica o aparelho quando há UM: com vários a linha já é agregada
    // por pessoa e apontar um endpoint específico seria enganoso.
    providerId: subs.length === 1 ? marcaDoAparelho(subs[0].endpoint) : null,
  };
}

export async function sendPushToUser(
  recipientId: string,
  payload: PushPayload,
  ctx?: EntregaCtx,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: subs } = await supabase.rpc("get_push_subs", { p_profile: recipientId });
    const lista = subs ?? [];
    const r = await sendPushToSubs(lista, payload);
    if (ctx) await registrarEntrega({ ...ctx, channel: "push", ...telemetriaDoPush(r, lista) });
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
  ctx?: EntregaCtx,
): Promise<void> {
  try {
    const { data } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", recipientId);
    const lista = data ?? [];
    const r = await sendPushToSubs(lista, payload);
    if (ctx) {
      await registrarEntregaAdmin(admin, { ...ctx, channel: "push", ...telemetriaDoPush(r, lista) });
    }
    // Só aqui dá pra limpar: a RLS de `push_subscriptions` exige
    // `profile_id = auth.uid()`, então o caminho com sessão (sendPushToUser)
    // não pode apagar a inscrição de OUTRA pessoa. Com service-role, pode — e é
    // o que impede o cron de bater no mesmo endpoint morto todo dia.
    if (r.mortos.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", r.mortos);
    }
  } catch {
    /* push é best-effort */
  }
}
