"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/modal";
import { EventTeams } from "@/components/event/event-teams";
import { carregarEventoParaModal, type EventoModalData } from "@/lib/actions";
import { fmtEventWhen } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * Bottom-sheet com a escala da(s) equipe(s) que o usuário gerencia num evento,
 * editável ali mesmo (reusa EventTeams) + link pra escala completa. `event=null`
 * fecha. O detalhe é recarregado sempre que `revalidateKey` muda (ex.: a
 * lista/página revalidou após um router.refresh() vindo do EventTeams), então a
 * escala no modal reflete a última edição.
 */
export function EventEscalaModal({
  event,
  revalidateKey,
  onClose,
}: {
  event: EventListItem | null;
  revalidateKey: unknown;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EventoModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const eventId = event?.id ?? null;

  useEffect(() => {
    if (!eventId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoading(true);
    carregarEventoParaModal(eventId).then((d) => {
      if (alive) {
        setDetail(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, revalidateKey]);

  return (
    <Modal open={!!event} onClose={onClose} sheet title={event?.title ?? ""}>
      {event ? (
        <div className="pt-1">
          <p className="mb-3 text-sm capitalize text-muted-foreground">{fmtEventWhen(event.starts_at)}</p>
          {loading || !detail ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !detail.ok || !detail.teams ? (
            <p className="py-8 text-center text-sm text-destructive">{detail.error ?? "Não foi possível carregar."}</p>
          ) : detail.teams.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Você não gerencia equipes neste evento.</p>
          ) : (
            <EventTeams eventId={event.id} canCheckin={!!detail.canCheckin} teams={detail.teams} />
          )}
          <div className="mt-4 border-t border-border/60 pt-3">
            <Link href={`/escalas/${event.id}`} className="text-sm font-semibold text-primary hover:underline">
              Ver escala completa →
            </Link>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
