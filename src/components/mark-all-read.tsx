"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { marcarNotificacoesLidas } from "@/lib/actions";

/** Ao abrir a tela de Notificações, marca tudo como lido (limpa o sino). */
export function MarkAllRead() {
  const router = useRouter();
  useEffect(() => {
    marcarNotificacoesLidas().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
