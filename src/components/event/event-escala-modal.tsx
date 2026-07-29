"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { EventTeams } from "@/components/event/event-teams";
import { GerenciarEventoSheet } from "@/components/event/gerenciar-evento-sheet";
import { carregarEventoParaModal, type EventoModalData } from "@/lib/actions";
import { fmtEventWhen } from "@/lib/format";

/**
 * Modal ÚNICO da escala de um evento (não há mais página). Carrega tudo por id.
 * Mostra todas as equipes da visão do usuário; quem está escalado responde ali.
 * Admin gerencia o culto (editar/responsável/arquivar/excluir) num sheet por
 * cima — sem sair do modal. Recarrega quando `revalidateKey` muda ou após uma
 * edição interna.
 */
export function EventEscalaModal({
  eventId,
  revalidateKey,
  onClose,
}: {
  eventId: string | null;
  revalidateKey: unknown;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EventoModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [manage, setManage] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!eventId) {
      setDetail(null);
      setManage(false);
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
  }, [eventId, revalidateKey, reload]);

  const isAdmin = detail?.ok && detail.role === "admin";

  return (
    <Modal open={!!eventId} onClose={onClose} sheet title={detail?.title ?? "Escala"}>
      {eventId ? (
        <div className="pt-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm capitalize text-muted-foreground">
              {detail?.startsAt ? fmtEventWhen(detail.startsAt) : ""}
              {detail?.archivedAt ? " · arquivado" : ""}
            </p>
            {isAdmin ? (
              <button
                onClick={() => setManage(true)}
                aria-label="Gerenciar culto"
                className="press-sm inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[13px] font-bold text-primary"
              >
                <Settings2 className="size-4" /> Gerenciar
              </button>
            ) : null}
          </div>

          {loading || !detail ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !detail.ok || !detail.teams ? (
            <p className="py-8 text-center text-sm text-destructive">{detail.error ?? "Não foi possível carregar."}</p>
          ) : detail.teams.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma equipe da sua visão neste evento.</p>
          ) : (
            <EventTeams
              eventId={eventId}
              startsAt={detail.startsAt!}
              canCheckin={!!detail.canCheckin}
              teams={detail.teams}
              availableTeams={detail.availableTeams ?? []}
            />
          )}

          {isAdmin && detail ? (
            <GerenciarEventoSheet
              open={manage}
              onClose={() => setManage(false)}
              onChanged={() => setReload((n) => n + 1)}
              onDeleted={() => {
                setManage(false);
                onClose();
              }}
              eventId={eventId}
              startsAt={detail.startsAt!}
              endsAt={detail.endsAt ?? null}
              callTimeIso={detail.callTime ?? null}
              location={detail.location ?? null}
              lat={detail.latitude ?? null}
              lng={detail.longitude ?? null}
              churchLat={detail.churchLat ?? null}
              churchLng={detail.churchLng ?? null}
              archived={!!detail.archivedAt}
              isResponsible={!!detail.isResponsible}
              responsibleName={detail.responsibleName ?? null}
              confirmedAt={detail.confirmedAt ?? null}
              profiles={detail.profiles ?? []}
            />
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
