"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { EscalasList } from "@/components/escalas-list";
import { useEventModal } from "@/components/event/event-modal-provider";
import type { EventListItem } from "@/lib/data";

/**
 * Aba Escalas = só a lista. O modal da escala mora no layout
 * (EventModalProvider), então tocar num card não navega mais — ele sobe por cima.
 *
 * `openId` existe pro DEEP LINK: /escalas/[id] (notificação, e-mail, evento
 * recém-criado) manda abrir o modal ao montar e limpa a URL com history
 * replaceState — sem replaceState o fechar voltaria a navegar, e sem limpar a URL
 * o modal reabriria a cada refresh da página.
 */
export function EscalasView({
  events,
  canManage,
  openId,
}: {
  events: EventListItem[];
  canManage: boolean;
  openId: string | null;
}) {
  const modal = useEventModal();
  const router = useRouter();
  const abriu = useRef<string | null>(null);

  useEffect(() => {
    if (!openId || !modal || abriu.current === openId) return;
    abriu.current = openId;
    modal.abrirEscala(openId);
    // Limpa a URL pelo router (não por history.replaceState) pra não dessincronizar
    // o histórico do Next. O modal NÃO fecha: ele vive no layout, que sobrevive à
    // troca de /escalas/[id] pra /escalas.
    router.replace("/escalas");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  return <EscalasList events={events} canManage={canManage} />;
}
