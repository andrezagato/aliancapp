"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";
import { Modal } from "@/components/modal";
import { EventTeams } from "@/components/event/event-teams";
import { EscalarPaneContent } from "@/components/leader-controls";
import { AjustesPanel } from "@/components/event/gerenciar-evento-sheet";
import { carregarEventoParaModal, type EventoModalData } from "@/lib/actions";
import { fmtEventWhen } from "@/lib/format";
import type { RundownItem } from "@/lib/data";
import { cn } from "@/lib/utils";

type Tab = "equipes" | "roteiro";

type Pane =
  | { kind: "ajustes" }
  | { kind: "escalar"; teamId: string; positionId: string; requirementId: string | null; positionName: string };

/**
 * Modal ÚNICO da escala de um evento (não há mais página). "Gerenciar culto"
 * e "Escalar" são painéis que DESLIZAM dentro deste mesmo sheet (nada de
 * sheet-sobre-sheet) — voltam pro conteúdo raiz (Equipes/Roteiro) através do
 * "‹ Escalas"/"‹ Roteiro" no topo, que o próprio Modal desenha. Carrega tudo
 * por id. Recarrega quando `revalidateKey` muda ou após uma edição interna.
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
  // espelho do detail pra decidir "é primeira carga?" sem virar dependência do efeito
  const detailRef = useRef<EventoModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("equipes");
  const [reload, setReload] = useState(0);
  const [pane, setPane] = useState<Pane | null>(null);
  const [returnTab, setReturnTab] = useState<Tab>("equipes");
  const [backTick, setBackTick] = useState(0);

  useEffect(() => {
    setPane(null);
    setBackTick(0);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setDetail(null);
      detailRef.current = null;
      setTab("equipes");
      return;
    }
    let alive = true;
    // "Carregando…" só na PRIMEIRA carga. Recarga (depois de escalar alguém, de
    // confirmar presença, de um refresh) acontece por baixo, com o conteúdo
    // antigo na tela — era esse loading no meio do caminho que dava a sensação
    // de o sheet piscar / subir duas vezes.
    setLoading((atual) => atual || detailRef.current === null);
    carregarEventoParaModal(eventId).then((d) => {
      if (alive) {
        setDetail(d);
        detailRef.current = d;
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, revalidateKey, reload]);

  const isAdmin = detail?.ok && detail.role === "admin";
  const tabs: [Tab, string][] = [
    ["equipes", "Equipes"],
    ["roteiro", "Roteiro"],
  ];

  function openAjustes() {
    setReturnTab(tab);
    setPane({ kind: "ajustes" });
  }
  function openEscalar(args: { teamId: string; positionId: string; requirementId: string | null; positionName: string }) {
    setReturnTab(tab);
    setPane({ kind: "escalar", ...args });
  }
  function goBack() {
    setPane(null);
    setBackTick((n) => n + 1);
  }

  const backLabel = returnTab === "equipes" ? "Escalas" : "Roteiro";

  return (
    <Modal
      open={!!eventId}
      onClose={onClose}
      sheet
      title={detail?.title ?? "Escala"}
      onBack={pane ? goBack : undefined}
      backLabel={backLabel}
    >
      {eventId ? (
        <div className="pt-1">
          {!pane ? (
            <p className="mb-3 text-sm capitalize text-muted-foreground">
              {detail?.startsAt ? fmtEventWhen(detail.startsAt) : ""}
              {detail?.responsibleName ? ` · responsável: ${detail.responsibleName}` : ""}
              {detail?.archivedAt ? " · arquivado" : ""}
            </p>
          ) : null}

          {loading || !detail ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !detail.ok || !detail.teams ? (
            <p className="py-8 text-center text-sm text-destructive-ink">{detail.error ?? "Não foi possível carregar."}</p>
          ) : pane ? (
            <div key={pane.kind === "escalar" ? `escalar-${pane.positionId}` : "ajustes"} className="animate-push">
              {pane.kind === "ajustes" ? (
                <AjustesPanel
                  onChanged={() => setReload((n) => n + 1)}
                  onDeleted={() => {
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
              ) : (
                <EscalarPaneContent
                  eventId={eventId}
                  teamId={pane.teamId}
                  positionId={pane.positionId}
                  requirementId={pane.requirementId}
                  positionName={pane.positionName}
                  onDone={goBack}
                />
              )}
            </div>
          ) : (
            <div key={`root-${backTick}`} className={backTick > 0 ? "animate-pull" : undefined}>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex flex-1 rounded-full bg-muted/60 p-1 text-[13px] font-bold">
                  {tabs.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={cn(
                        "flex-1 rounded-full py-1.5 text-center transition-colors",
                        tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={openAjustes}
                    aria-label="Ajustes do culto"
                    className="press-sm grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
                  >
                    <Settings className="size-[18px]" />
                  </button>
                ) : null}
              </div>

              {tab === "equipes" ? (
                detail.teams.length === 0 && (detail.availableTeams?.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma equipe da sua visão neste evento.</p>
                ) : (
                  // Mesmo sem equipe própria aqui ainda, líder/admin pode ter uma equipe
                  // pra ADICIONAR (availableTeams) — EventTeams já mostra isso sozinho.
                  <EventTeams
                    eventId={eventId}
                    startsAt={detail.startsAt!}
                    canCheckin={!!detail.canCheckin}
                    teams={detail.teams}
                    availableTeams={detail.availableTeams ?? []}
                    onEscalar={openEscalar}
                  />
                )
              ) : null}

              {tab === "roteiro" ? <RoteiroPreview eventId={eventId} items={detail.rundown ?? []} /> : null}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

/** Prévia só-leitura do roteiro deste evento — o roteiro de verdade (rodando,
 * editável, ao vivo) continua em /cronograma; aqui é atalho de contexto. */
function RoteiroPreview({ eventId, items }: { eventId: string; items: RundownItem[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum bloco no roteiro ainda.</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-baseline gap-3">
              <span className="w-5 shrink-0 text-right font-display text-[15px] font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{it.title}</p>
                {it.responsible ? <p className="truncate text-[12.5px] text-muted-foreground">{it.responsible}</p> : null}
              </div>
              {it.durationMin ? <span className="shrink-0 text-[12.5px] text-muted-foreground">{it.durationMin} min</span> : null}
            </li>
          ))}
        </ol>
      )}
      <Link
        href={`/cronograma?ev=${eventId}`}
        className="press-sm flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-bold text-primary"
      >
        Abrir roteiro completo <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
