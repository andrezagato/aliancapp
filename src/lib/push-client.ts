"use client";

import { salvarPushSubscription, removerPushSubscription } from "@/lib/actions";

/**
 * Lado-navegador do Web Push. Existe separado do `push-setup.tsx` porque agora
 * são DOIS consumidores: o botão de opt-in (pede permissão) e o `PushSync` do
 * shell (reconcilia em silêncio, sem nunca pedir nada). Duas cópias da mesma
 * lógica divergiriam — e o bug que isto conserta nasceu justamente de a
 * assinatura existir só dentro de um `onClick`.
 */

/** base64url da chave VAPID → bytes, que é o que o `pushManager` aceita. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * A inscrição deste aparelho foi criada com a chave pública que o app usa HOJE?
 *
 * Quando o navegador não expõe `options.applicationServerKey`, responde que sim:
 * desassinar no escuro a cada carga do app seria pior que não conferir — geraria
 * um endpoint novo por visita e enfileiraria lixo no banco.
 */
function mesmaChave(sub: PushSubscription, base64: string): boolean {
  const atual = sub.options?.applicationServerKey;
  if (!atual) return true;
  const a = new Uint8Array(atual);
  const b = urlBase64ToUint8Array(base64);
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function assinarESalvar(reg: ServiceWorkerRegistration, base64: string): Promise<void> {
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(base64) as BufferSource,
  });
  const json = sub.toJSON();
  await salvarPushSubscription({
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  });
}

export type ResultadoSync =
  | "sem-suporte"
  | "sem-permissao"
  | "sem-chave"
  | "criada"
  | "reassinada"
  | "confirmada"
  | "falhou";

/**
 * Reconcilia a inscrição deste aparelho com o par VAPID atual. NUNCA pede
 * permissão: se ela não foi concedida, sai fora e o usuário não vê nada.
 *
 * Por que isto tem que existir: a tela do perfil mostra "Notificações ativadas
 * neste aparelho" com base apenas em `Notification.permission`, que continua
 * "granted" mesmo quando a inscrição por trás morreu. Sem reconciliar, dois
 * casos matam o push pra sempre e em silêncio — (1) o par VAPID ser trocado,
 * que faz o serviço de push rejeitar as inscrições antigas com 403, e (2) o
 * navegador expirar/renovar a inscrição por conta própria. Em ambos o app
 * seguiria jurando que está tudo ligado.
 *
 * `confirmada` reafirma a linha no banco: ela pode ter sumido (limpeza de
 * inscrição morta) ou nunca ter sido gravada, se o primeiro opt-in falhou
 * depois de o navegador já ter assinado.
 */
export async function sincronizarPush(): Promise<ResultadoSync> {
  if (typeof window === "undefined") return "sem-suporte";
  const suportado =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!suportado) return "sem-suporte";
  if (Notification.permission !== "granted") return "sem-permissao";

  const base64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!base64) return "sem-chave";

  try {
    const reg = await navigator.serviceWorker.ready;
    const atual = await reg.pushManager.getSubscription();

    if (!atual) {
      await assinarESalvar(reg, base64);
      return "criada";
    }

    if (mesmaChave(atual, base64)) {
      const json = atual.toJSON();
      await salvarPushSubscription({
        endpoint: atual.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      return "confirmada";
    }

    // Chave trocada: daqui pra frente esta inscrição só devolve 403. Apaga a
    // linha ANTES de desassinar — depois do `unsubscribe()` o endpoint ainda é
    // conhecido, mas se o `unsubscribe` falhar a linha morta teria ficado.
    await removerPushSubscription(atual.endpoint);
    await atual.unsubscribe().catch(() => false);
    await assinarESalvar(reg, base64);
    return "reassinada";
  } catch {
    // Best-effort de propósito: isto roda no carregamento de toda tela do app e
    // não pode atrapalhar nada. O usuário sempre tem o botão do perfil.
    return "falhou";
  }
}

/** Fluxo do botão: pede permissão e então assina. Só ele pode abrir o prompt. */
export async function pedirPermissaoEAssinar(): Promise<NotificationPermission> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;
  const base64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!base64) return perm;
  const reg = await navigator.serviceWorker.ready;
  await assinarESalvar(reg, base64);
  return perm;
}
