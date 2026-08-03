"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Check } from "lucide-react";
import { pedirPermissaoEAssinar, sincronizarPush } from "@/lib/push-client";

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
    // Quem já concedeu permissão nunca passava por aqui de novo: o ramo
    // "granted" só desenhava um texto. Se a inscrição por trás tivesse morrido
    // (chave VAPID trocada, expiração do navegador), o push estava desligado e
    // esta tela dizia o contrário. Reconciliar é justamente o conserto.
    void sincronizarPush();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      setStatus((await pedirPermissaoEAssinar()) as Status);
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
