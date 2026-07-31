"use client";

import Link from "next/link";
import { useEventModal } from "@/components/event/event-modal-provider";

/**
 * Abre a escala de um evento SEM sair da tela — o substituto de
 * `<Link href="/escalas/[id]">` em qualquer lugar do app (herói da home, dia do
 * calendário, lista de finalizados…).
 *
 * Mantém o mesmo `className` do link que substitui, então o visual não muda; o
 * que muda é que nada navega. Fora do provider (ou sem JS) volta a ser um link
 * de verdade, então deep-link e acessibilidade continuam de pé.
 */
export function AbrirEscala({
  eventId,
  className,
  children,
  ariaLabel,
}: {
  eventId: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const modal = useEventModal();
  if (!modal) {
    return (
      <Link href={`/escalas/${eventId}`} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => modal.abrirEscala(eventId)} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
