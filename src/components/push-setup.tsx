"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Check } from "lucide-react";
import { salvarPushSubscription } from "@/lib/actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "default" | "granted" | "denied";

/** Botão de opt-in de push: registra o SW e assina o pushManager. */
export function PushSetup() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!ok) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    setStatus(Notification.permission as Status);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setStatus(perm as Status);
      if (perm !== "granted") return;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await salvarPushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return null;

  if (status === "unsupported") {
    return (
      <p className="text-[13px] text-muted-foreground">
        Notificações não são suportadas aqui. No iPhone, toque em Compartilhar → “Adicionar à Tela de
        Início” e abra o app por lá pra ativar.
      </p>
    );
  }

  if (status === "granted") {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-ink">
        <Check className="size-4" /> Notificações ativadas neste aparelho
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <BellOff className="size-4" /> Notificações bloqueadas — ative nas configurações do navegador/app.
      </p>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="press inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
    >
      <BellRing className="size-4" /> {busy ? "Ativando…" : "Ativar notificações"}
    </button>
  );
}
