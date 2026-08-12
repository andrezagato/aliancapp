"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, CircleSlash, RotateCcw, Check, CalendarOff, Ban, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { useToast } from "@/components/ui/toast";
import { cn, displayName } from "@/lib/utils";
import { fmtDayMonthShort } from "@/lib/format";
import {
  buscarElegiveis,
  escalarVoluntario,
  removerEscalacao,
  marcarNaoSeAplica,
  definirNecessario,
  adicionarEquipeAoEvento,
  removerEquipeDoEvento,
} from "@/lib/actions";
import type { EligibleMember } from "@/lib/data";

// -----------------------------------------------------------------------------
// Escalar (líder escolhe quem entra numa posição) — o gatilho fica na linha da
// posição; o conteúdo desliza como painel lateral dentro do mesmo sheet do
// evento (EventEscalaModal decide o "voltar"), não abre Modal próprio.
// -----------------------------------------------------------------------------
export function EscalarTrigger({ openCount, onOpen }: { openCount: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-primary/40 bg-primary/[0.03] px-3 py-1.5 text-primary"
    >
      <Plus className="size-4" />
      <span className="text-[13px] font-bold">Escalar</span>
      <span className="text-[12px] font-bold text-destructive-ink">
        · {openCount} vaga{openCount > 1 ? "s" : ""}
      </span>
    </button>
  );
}

export function EscalarPaneContent({
  eventId,
  teamId,
  positionId,
  requirementId,
  positionName,
  onDone,
}: {
  eventId: string;
  teamId: string;
  positionId: string;
  requirementId: string | null;
  positionName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [members, setMembers] = useState<EligibleMember[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadingList(true);
    buscarElegiveis(eventId, teamId, positionId).then((list) => {
      if (alive) {
        setMembers(list);
        setLoadingList(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [eventId, teamId, positionId]);

  function escalar(profileId: string, override = false) {
    setError(null);
    start(async () => {
      const r = await escalarVoluntario({ eventId, teamId, positionId, requirementId, profileId }, override);
      if (!r.ok) {
        if (r.code) setConfirmId(profileId);
        else setError(r.error);
        return;
      }
      const nm = members?.find((x) => x.profileId === profileId)?.name?.split(/\s+/)[0];
      setConfirmId(null);
      showToast(nm ? `Convite enviado a ${nm}.` : "Convite enviado.");
      router.refresh();
      onDone();
    });
  }

  function onPick(m: EligibleMember) {
    if (m.blockedOtherTeam) return;
    if (m.unavailable || m.alreadyInTeam) setConfirmId(m.profileId);
    else escalar(m.profileId, false);
  }

  return (
    <div>
      <h3 className="font-display text-[17px] font-extrabold leading-tight text-foreground">Escalar · {positionName}</h3>
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
                disabled={pending || m.blockedOtherTeam}
                onClick={() => onPick(m)}
                className={cn(
                  "press-sm flex w-full items-center gap-3 rounded-[16px] border p-2.5 text-left disabled:cursor-default",
                  m.blockedOtherTeam ? "border-border bg-muted/40 opacity-60" : "border-border bg-card",
                )}
              >
                <Avatar name={m.name} src={m.avatarUrl} className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {displayName(m.nickname, m.name)}
                    {m.nickname ? <span className="font-normal text-muted-foreground"> · {m.name}</span> : null}
                  </p>
                  <p className={cn("truncate text-[12.5px]", m.unavailable ? "text-destructive-ink" : "text-muted-foreground")}>
                    {m.unavailable
                      ? "Indisponível nesse dia"
                      : m.lastServedISO
                        ? `Serviu por último em ${fmtDayMonthShort(m.lastServedISO)}`
                        : "Nunca serviu nesta função"}
                  </p>
                </div>
                {m.blockedOtherTeam ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-extrabold text-muted-foreground">
                    <Ban className="size-3.5" /> Em outra equipe
                  </span>
                ) : m.unavailable ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11.5px] font-extrabold text-destructive-ink">
                    <CalendarOff className="size-3.5" /> Indisponível
                  </span>
                ) : m.alreadyInTeam ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[11.5px] font-extrabold text-warning-ink">
                    <Repeat className="size-3.5" /> 2ª função
                  </span>
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    {m.knowsPosition ? <Check className="size-4" strokeWidth={2.6} /> : <Plus className="size-4" strokeWidth={2.6} />}
                  </span>
                )}
              </button>
              {confirmId === m.profileId ? (
                <div className="mx-1 mt-1 rounded-[14px] bg-warning/10 p-3">
                  <p className="mb-2 text-xs font-semibold text-warning-ink">
                    {m.unavailable && m.alreadyInTeam
                      ? `${m.name} marcou indisponível e já está em outra função da equipe hoje. Escalar mesmo assim?`
                      : m.unavailable
                        ? `${m.name} marcou indisponível nesse dia. Escalar mesmo assim?`
                        : `${m.name} já está em outra função desta equipe hoje. Escalar mesmo assim?`}
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
      {error ? <p className="mt-2 text-sm text-destructive-ink">{error}</p> : null}
    </div>
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
      {error ? <p className="mt-2 text-sm text-destructive-ink">{error}</p> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Remover equipe de um evento (admin) — apaga escalações + posições da equipe
// -----------------------------------------------------------------------------
export function RemoverEquipeButton({
  eventId,
  teamId,
  teamName,
  assigned,
}: {
  eventId: string;
  teamId: string;
  teamName: string;
  assigned: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const remove = () => {
    const msg =
      assigned > 0
        ? `Remover a equipe ${teamName} deste evento? Isso apaga ${assigned} escalação(ões) dela.`
        : `Remover a equipe ${teamName} deste evento?`;
    if (!window.confirm(msg)) return;
    start(async () => {
      const r = await removerEquipeDoEvento(eventId, teamId);
      if (r.ok) router.refresh();
      else window.alert(r.error);
    });
  };
  return (
    <button
      onClick={remove}
      disabled={pending}
      aria-label={`Remover ${teamName} do evento`}
      className="press-sm grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive-ink disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function NecessarioStepper({
  requirementId,
  eventId,
  teamId,
  needed,
  notApplicable = false,
}: {
  requirementId: string;
  eventId: string;
  teamId: string;
  needed: number;
  /** posição marcada como "não se aplica" → mostra 0 (o + reativa). */
  notApplicable?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [n, setN] = useState(notApplicable ? 0 : needed);

  function change(next: number) {
    const clamped = Math.max(0, Math.min(20, next));
    setN(clamped);
    start(async () => {
      const r = await definirNecessario(requirementId, clamped, eventId, teamId);
      if (!r.ok) setN(notApplicable ? 0 : needed);
      else router.refresh();
    });
  }

  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => change(n - 1)}
        disabled={pending || n === 0}
        className="press-sm grid size-6 place-items-center rounded-full text-muted-foreground disabled:opacity-30"
        aria-label="Menos"
      >
        <Minus className="size-3.5" />
      </button>
      <span className={cn("w-4 text-center text-sm font-bold tabular-nums", n === 0 && "text-muted-foreground")}>{n}</span>
      <button
        type="button"
        onClick={() => change(n + 1)}
        disabled={pending}
        className="press-sm grid size-6 place-items-center rounded-full text-primary"
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
      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive-ink"
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
