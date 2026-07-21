"use client";

import { useRouter } from "next/navigation";
import { EscalasList } from "@/components/escalas-list";
import { EventEscalaModal } from "@/components/event/event-escala-modal";
import type { EventListItem } from "@/lib/data";

/**
 * Aba Escalas = lista + modal da escala. A escala NÃO tem página própria: abrir
 * um evento é `/escalas/[id]`, que renderiza esta view com o modal aberto
 * (`openId`). Fechar o modal volta pra `/escalas`. Deep-links seguem valendo.
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
  const router = useRouter();
  return (
    <>
      <EscalasList events={events} canManage={canManage} />
      <EventEscalaModal eventId={openId} revalidateKey={events} onClose={() => router.push("/escalas")} />
    </>
  );
}
