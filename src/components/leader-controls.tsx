"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, CircleSlash, RotateCcw, Check, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { useToast } from "@/components/ui/toast";
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
  const { showToast } = useToast();
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
      const nm = members?.find((x) => x.profileId === profileId)?.name?.split(/\s+/)[0];
      setConfirmId(null);
      setOpen(false);
      setMembers(null);
      showToast(nm ? `Convite enviado a ${nm}.` : "Convite enviado.");
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
        className="press flex w-full items-center gap-2.5 rounded-[13px] border-[1.5px] border-dashed border-primary/35 bg-primary/[0.03] px-3 py-2.5 text-left text-primary"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-dashed border-primary/40">
          <Plus className="size-4" />
        </span>
        <span className="text-sm font-bold">Escalar {positionName}</span>
        <span className="ml-auto text-xs font-bold text-destructive">
          {openCount} vaga{openCount > 1 ? "s" : ""}
        </span>
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)} sheet title={`Escalar · ${positionName}`}>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          Quem sabe fazer, com a última vez que serviu. Toque para convidar.
        </p>
        <div className="mt-3 space-y-2">
          {loadingList ? (
            <p className="p-3 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : members && members.length > 0 ? (
            members.map((m) => (
              <div key={m.profileId}>
                <button
                  type="button"
                  disabled={pending || m.alreadyInEvent}
                  onClick={() => onPick(m)}
                  className={cn(
                    "press-sm flex w-full items-center gap-3 rounded-[16px] border p-2.5 text-left disabled:cursor-default",
                    m.unavailable ? "border-border bg-muted/40 opacity-60" : "border-border bg-card",
                  )}
                >
                  <Avatar name={m.name} src={m.avatarUrl} className="size-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.name}</p>
                    <p className={cn("truncate text-[12.5px]", m.unavailable ? "text-destructive" : "text-muted-foreground")}>
                      {m.unavailable
                        ? "Indisponível nesse dia"
                        : m.lastServedISO
                          ? `Serviu por último em ${fmtDayMonthShort(m.lastServedISO)}`
                          : "Nunca serviu nesta função"}
                    </p>
                  </div>
                  {m.alreadyInEvent ? (
                    <span className="shrink-0 text-[11.5px] font-extrabold text-success">Já na escala</span>
                  ) : m.unavailable ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11.5px] font-extrabold text-destructive">
                      <CalendarOff className="size-3.5" /> Indisponível
                    </span>
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      {m.knowsPosition ? <Check className="size-4" strokeWidth={2.6} /> : <Plus className="size-4" strokeWidth={2.6} />}
                    </span>
                  )}
                </button>
                {confirmId === m.profileId ? (
                  <div className="mx-1 mt-1 rounded-[14px] bg-warning/10 p-3">
                    <p className="mb-2 text-xs font-semibold text-warning">
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
              </div>
            ))
          ) : (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Ninguém disponível nesta equipe ainda. Convide ou adicione pessoas à equipe.
            </p>
          )}
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="mt-3 h-11 w-full text-[14.5px] font-bold text-muted-foreground"
        >
          Fechar
        </button>
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
