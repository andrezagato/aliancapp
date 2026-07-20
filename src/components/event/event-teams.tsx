"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CircleSlash, BadgeCheck, Pencil, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CoverageBadge, TeamDot } from "@/components/coverage-badge";
import { ConfirmationAlert } from "@/components/event/confirmation-alert";
import { AssignmentResponse } from "@/components/assignment-response";
import { CheckinButton, SwapPending } from "@/components/slot-controls";
import { WhatsAppButton, WhatsAppGroupButton } from "@/components/whatsapp-button";
import {
  EscalarDialog,
  RemoveAssignmentButton,
  NecessarioStepper,
} from "@/components/leader-controls";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { fmtEventWhen } from "@/lib/format";
import type { DetailTeam, DetailPosition } from "@/lib/data";

const MODE_KEY = "sirvo:evt-mode";
const EXPAND_KEY = "sirvo:evt-expand-all";

const SHORT: Record<string, string> = {
  confirmado: "Confirmado",
  presente: "Presente",
  convidado: "Aguardando",
  recusado: "Recusou",
  vaga_aberta: "Vaga",
};

/**
 * Equipes do evento para gestor (admin/líder) com dois controles que se
 * combinam: (1) recolher/expandir cada equipe — começa recolhido quando há
 * várias, com "expandir/recolher tudo" e preferência salva no aparelho; e
 * (2) modo Ver (linha compacta, status pela cor, sinal ! de ação) × Editar
 * (revela steppers, escalar, lixeira, troca…). Só recebe equipes gerenciáveis.
 */
export function EventTeams({
  eventId,
  startsAt,
  canCheckin,
  teams,
}: {
  eventId: string;
  startsAt: string;
  canCheckin: boolean;
  teams: DetailTeam[];
}) {
  const multi = teams.length > 1;
  const pendingConfirms = teams.reduce((s, t) => s + Math.max(t.assigned - t.confirmed, 0), 0);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(teams.map((t) => [t.teamId, !multi])),
  );

  // Preferências do aparelho (aplicadas após montar → sem quebrar a hidratação).
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "edit" || m === "view") setMode(m);
      const e = localStorage.getItem(EXPAND_KEY);
      const all = e === "1" ? true : e === "0" ? false : !multi;
      setExpanded(Object.fromEntries(teams.map((t) => [t.teamId, all])));
    } catch {
      /* localStorage indisponível — mantém o padrão */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistMode = (m: "view" | "edit") => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };
  const toggleTeam = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));
  const setAll = (v: boolean) => {
    setExpanded(Object.fromEntries(teams.map((t) => [t.teamId, v])));
    try {
      localStorage.setItem(EXPAND_KEY, v ? "1" : "0");
    } catch {}
  };
  const allExpanded = teams.every((t) => expanded[t.teamId]);

  return (
    <div className="space-y-3">
      <ConfirmationAlert eventId={eventId} startsAt={startsAt} pending={pendingConfirms} />

      <div className="flex items-center justify-between px-1">
        {multi ? (
          <button onClick={() => setAll(!allExpanded)} className="press-sm text-sm font-bold text-primary">
            {allExpanded ? "Recolher tudo" : "Expandir tudo"}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => persistMode(mode === "edit" ? "view" : "edit")}
          className="press-sm inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-bold text-primary"
        >
          {mode === "edit" ? (
            <>
              <Check className="size-4" /> Concluir
            </>
          ) : (
            <>
              <Pencil className="size-4" /> Editar
            </>
          )}
        </button>
      </div>

      {teams.map((team) => {
        const open = expanded[team.teamId];
        const needsAction = team.positions.some(
          (p) => p.openCount > 0 || p.filled.some((f) => f.swap || f.status === "convidado"),
        );
        return (
          <Card key={team.teamId} className="overflow-hidden">
            <div className="flex w-full items-center gap-2 p-4">
              <button
                onClick={() => toggleTeam(team.teamId)}
                className="press-sm flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-expanded={open}
              >
                <TeamDot color={team.color} className="size-3" />
                <h2 className="truncate font-display text-[17px] font-bold text-foreground">{team.name}</h2>
                {needsAction ? (
                  <span
                    title="Precisa de atenção"
                    className="grid size-[18px] shrink-0 place-items-center rounded-full bg-warning/20 text-[11px] font-extrabold text-warning"
                  >
                    !
                  </span>
                ) : null}
                <CoverageBadge tone={team.tone} assigned={team.confirmed} needed={team.needed} className="ml-auto" />
              </button>
              <WhatsAppGroupButton href={team.whatsappGroup} label="Grupo" className="h-8 shrink-0 px-2.5 text-[13px]" />
              <button
                onClick={() => toggleTeam(team.teamId)}
                aria-label={open ? "Recolher" : "Expandir"}
                className="press-sm shrink-0"
              >
                <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>
            </div>

            {open ? (
              <ul className="divide-y divide-border/70 border-t border-border">
                {team.positions.map((pos) => (
                  <li key={pos.positionId} className="p-4">
                    {mode === "edit" ? (
                      <EditablePosition eventId={eventId} startsAt={startsAt} team={team} pos={pos} canCheckin={canCheckin} />
                    ) : (
                      <CompactPosition pos={pos} />
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

// ---- modo Ver (compacto) --------------------------------------------------
function CompactPosition({ pos }: { pos: DetailPosition }) {
  const notApplicable = pos.status === "not_applicable";
  const confirmed = pos.filled.filter((f) => f.status === "confirmado" || f.status === "presente").length;
  const waiting = pos.filled.filter((f) => f.status === "convidado").length;

  if (notApplicable) {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleSlash className="size-3.5" /> {pos.positionName} · não se aplica
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{pos.positionName}</span>
        <span className="text-xs font-semibold tabular-nums">
          <span className={cn(confirmed >= pos.needed ? "text-success" : "text-muted-foreground")}>
            {confirmed}/{pos.needed}
          </span>
          {waiting > 0 ? <span className="text-warning"> · {waiting} aguardando</span> : null}
        </span>
      </div>
      {pos.filled.map((person) => {
        const meta = STATUS_META[person.status];
        return (
          <div key={person.assignmentId} className="flex items-center gap-2.5 rounded-md bg-muted/25 px-2.5 py-1.5">
            <Avatar name={person.name} src={person.avatarUrl} className="size-7 text-[11px]" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
              {person.name}
              {person.isMe ? <span className="text-muted-foreground"> (você)</span> : null}
            </span>
            {person.swap ? (
              <span
                title="Troca pendente"
                className="grid size-[18px] shrink-0 place-items-center rounded-full bg-warning/20 text-[10px] font-extrabold text-warning"
              >
                !
              </span>
            ) : null}
            {person.checkedIn ? (
              <Badge variant="success" className="shrink-0 gap-1 px-2 py-0.5 text-[11px]">
                <BadgeCheck className="size-3.5" /> Presente
              </Badge>
            ) : (
              <Badge variant={meta.variant} className="shrink-0 px-2 py-0.5 text-[11px]">
                {SHORT[person.status] ?? meta.label}
              </Badge>
            )}
          </div>
        );
      })}
      {pos.openCount > 0 ? (
        <p className="pl-2.5 text-[13px] font-medium text-destructive/90">
          {pos.openCount} vaga{pos.openCount > 1 ? "s" : ""} em aberto
        </p>
      ) : null}
    </div>
  );
}

// ---- modo Editar (controles completos, gestor) ----------------------------
function EditablePosition({
  eventId,
  startsAt,
  team,
  pos,
  canCheckin,
}: {
  eventId: string;
  startsAt: string;
  team: DetailTeam;
  pos: DetailPosition;
  canCheckin: boolean;
}) {
  const notApplicable = pos.status === "not_applicable";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={cn("min-w-0 truncate text-sm font-semibold", notApplicable && "text-muted-foreground")}>
          {pos.positionName}
        </p>
        <NecessarioStepper
          requirementId={pos.requirementId!}
          eventId={eventId}
          teamId={team.teamId}
          needed={pos.needed}
          notApplicable={notApplicable}
        />
      </div>

      {notApplicable ? null : (
        <div className="space-y-1.5">
          {pos.filled.map((person) => {
            const meta = STATUS_META[person.status];
            const showResponse =
              person.isMe && !person.swap && (person.status === "convidado" || person.status === "confirmado");
            const showActions = person.status !== "recusado" && ((person.phone && !person.isMe) || canCheckin);
            return (
              <div key={person.assignmentId} className="rounded-xl bg-muted/25 p-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={person.name} src={person.avatarUrl} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">
                      {person.name}
                      {person.isMe ? <span className="text-muted-foreground"> (você)</span> : null}
                    </p>
                    {person.status === "recusado" && person.declineReason ? (
                      <p className="truncate text-xs text-muted-foreground">Recusou: {person.declineReason}</p>
                    ) : null}
                  </div>
                  {showResponse ? (
                    <AssignmentResponse assignmentId={person.assignmentId} status={person.status} teamId={team.teamId} />
                  ) : (
                    <Badge variant={meta.variant} className="shrink-0 px-2 py-0.5 text-[11px]">
                      {SHORT[person.status] ?? meta.label}
                    </Badge>
                  )}
                  <RemoveAssignmentButton assignmentId={person.assignmentId} eventId={eventId} teamId={team.teamId} />
                </div>

                {showActions ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[42px]">
                    {person.phone && !person.isMe ? (
                      <WhatsAppButton
                        phone={person.phone}
                        message={`Oi ${person.name.split(/\s+/)[0]}! Passando pra confirmar sua presença na escala de ${team.name} (${fmtEventWhen(startsAt)}). Consegue? 🙏`}
                        className="h-8 px-2.5 text-[13px]"
                      />
                    ) : null}
                    {canCheckin ? (
                      <CheckinButton
                        assignmentId={person.assignmentId}
                        teamId={team.teamId}
                        eventId={eventId}
                        checkedIn={person.checkedIn}
                        canMark
                      />
                    ) : null}
                  </div>
                ) : null}

                {person.swap ? (
                  <div className="mt-1.5 pl-[42px]">
                    <SwapPending
                      swapId={person.swap.id}
                      eventId={eventId}
                      reason={person.swap.reason}
                      suggestedName={person.swap.suggestedName}
                      acceptedBySub={person.swap.acceptedBySub}
                      canManage
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {pos.openCount > 0 ? (
            <EscalarDialog
              eventId={eventId}
              teamId={team.teamId}
              positionId={pos.positionId}
              requirementId={pos.requirementId}
              positionName={pos.positionName}
              openCount={pos.openCount}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

