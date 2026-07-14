"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, CircleSlash, RotateCcw, Check, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { fmtDayMonthShort } from "@/lib/format";
import {
  buscarElegiveis,
  escalarVoluntario,
  removerEscalacao,
  marcarNaoSeAplica,
  ajustarNecessario,
  adicionarEquipeAoEvento,
} from "@/lib/actions";
import type { EligibleMember } from "@/lib/data";

// -----------------------------------------------------------------------------
// Escalar (líder escolhe quem entra numa posição)
// -----------------------------------------------------------------------------
export function EscalarDialog({
  eventId,
  teamId,
  positionId,
  requirementId,
  positionName,
  openCount,
}: {
  eventId: string;
  teamId: string;
  positionId: string;
  requirementId: string | null;
  positionName: string;
  openCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<EligibleMember[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setConfirmId(null);
    setLoadingList(true);
    const list = await buscarElegiveis(eventId, teamId, positionId);
    setMembers(list);
    setLoadingList(false);
  }

  function escalar(profileId: string, override = false) {
    setError(null);
    start(async () => {
      const r = await escalarVoluntario({ eventId, teamId, positionId, requirementId, profileId }, override);
      if (!r.ok) {
        if (r.code === "unavailable") setConfirmId(profileId);
        else setError(r.error);
        return;
      }
      setConfirmId(null);
      setOpen(false);
      setMembers(null);
      router.refresh();
    });
  }

  function onPick(m: EligibleMember) {
    if (m.unavailable) setConfirmId(m.profileId);
    else escalar(m.profileId, false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 p-3 text-left text-primary transition-colors hover:bg-primary/5"
      >
        <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-dashed border-primary/40">
          <Plus className="size-4" />
        </span>
        <span className="text-sm font-medium">
          Escalar {positionName}
          {openCount > 1 ? ` · ${openCount} vagas` : ""}
        </span>
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)}>
        <div className="flex max-h-[80dvh] flex-col rounded-2xl border border-border bg-card shadow-lift">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold">Escalar · {positionName}</h3>
            <p className="text-sm text-muted-foreground">Quem serve nesta posição?</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingList ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : members && members.length > 0 ? (
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.profileId}>
                    <button
                      type="button"
                      disabled={pending || m.alreadyInEvent}
                      onClick={() => onPick(m)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <Avatar name={m.name} src={m.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className={cn("text-xs", m.unavailable ? "font-medium text-warning" : "text-muted-foreground")}>
                          {m.alreadyInEvent
                            ? "Já escalado neste evento"
                            : m.unavailable
                              ? "Indisponível nesse dia"
                              : m.knowsPosition
                                ? "Faz esta função"
                                : "Da equipe"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.lastServedISO ? `Serviu por último em ${fmtDayMonthShort(m.lastServedISO)}` : "Nunca serviu nesta função"}
                        </p>
                      </div>
                      {m.unavailable && !m.alreadyInEvent ? (
                        <CalendarOff className="size-4 text-warning" />
                      ) : m.knowsPosition && !m.alreadyInEvent ? (
                        <Check className="size-4 text-success" />
                      ) : null}
                    </button>
                    {confirmId === m.profileId ? (
                      <div className="mx-1 mb-1 rounded-xl bg-warning/10 p-2.5">
                        <p className="mb-2 text-xs font-medium text-warning">
                          {m.name} marcou indisponível nesse dia. Escalar mesmo assim?
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => escalar(m.profileId, true)} disabled={pending}>
                            {pending ? "…" : "Escalar assim mesmo"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} disabled={pending}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Ninguém disponível nesta equipe ainda. Convide ou adicione pessoas à equipe.
              </p>
            )}
          </div>
          {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}
          <div className="border-t border-border p-3">
            <Button variant="ghost" className="w-full" onClick={() => setOpen(false)} disabled={pending}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Ajustar quantas pessoas a posição precisa (líder define no evento)
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Adicionar equipe a um evento (admin)
// -----------------------------------------------------------------------------
export function AdicionarEquipe({
  eventId,
  teams,
}: {
  eventId: string;
  teams: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add(teamId: string) {
    setError(null);
    start(async () => {
      const r = await adicionarEquipeAoEvento(eventId, teamId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-2 px-1 text-sm font-semibold">Adicionar equipe ao evento</p>
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => add(t.id)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card px-3 py-1.5 text-sm hover:border-primary/50 disabled:opacity-50"
          >
            <Plus className="size-3.5" /> <TeamDot color={t.color} /> {t.name}
          </button>
        ))}
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function NecessarioStepper({
  requirementId,
  eventId,
  teamId,
  needed,
}: {
  requirementId: string;
  eventId: string;
  teamId: string;
  needed: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [n, setN] = useState(needed);

  function change(next: number) {
    const clamped = Math.max(0, Math.min(20, next));
    setN(clamped);
    start(async () => {
      const r = await ajustarNecessario(requirementId, clamped, eventId, teamId);
      if (!r.ok) setN(needed);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">precisa</span>
      <button
        type="button"
        onClick={() => change(n - 1)}
        disabled={pending || n === 0}
        className="inline-flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
        aria-label="Menos"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-4 text-center text-sm font-semibold tabular-nums">{n}</span>
      <button
        type="button"
        onClick={() => change(n + 1)}
        disabled={pending}
        className="inline-flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
        aria-label="Mais"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Remover uma escalação (líder)
// -----------------------------------------------------------------------------
export function RemoveAssignmentButton({
  assignmentId,
  eventId,
  teamId,
}: {
  assignmentId: string;
  eventId: string;
  teamId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      const r = await removerEscalacao(assignmentId, eventId, teamId);
      if (r.ok) router.refresh();
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="destructive" onClick={remove} disabled={pending}>
          {pending ? "…" : "Remover"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Remover da escala"
      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

// -----------------------------------------------------------------------------
// "Não se aplica" (líder dispensa a posição neste evento)
// -----------------------------------------------------------------------------
export function NaoSeAplicaToggle({
  requirementId,
  eventId,
  teamId,
  naoSeAplica,
}: {
  requirementId: string;
  eventId: string;
  teamId: string;
  naoSeAplica: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const r = await marcarNaoSeAplica(requirementId, !naoSeAplica, eventId, teamId);
      if (r.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
    >
      {naoSeAplica ? (
        <>
          <RotateCcw className="size-3.5" /> Reativar posição
        </>
      ) : (
        <>
          <CircleSlash className="size-3.5" /> Não se aplica
        </>
      )}
    </button>
  );
}
