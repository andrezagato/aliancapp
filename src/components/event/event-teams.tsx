"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCheck, Check, Clock, X, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CoverageBadge, TeamDot } from "@/components/coverage-badge";
import { ConfirmationAlert } from "@/components/event/confirmation-alert";
import { AssignmentResponse } from "@/components/assignment-response";
import { CheckinButton, SwapPending } from "@/components/slot-controls";
import { WhatsAppButton, WhatsAppGroupButton } from "@/components/whatsapp-button";
import { EscalarDialog, NecessarioStepper, AdicionarEquipe, RemoverEquipeButton } from "@/components/leader-controls";
import { definirStatusEscala, removerEscalacao } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { fmtEventWhen } from "@/lib/format";
import type { DetailTeam, DetailPosition, SlotPerson } from "@/lib/data";

/** Estados de status que o gestor alterna, em símbolos (uma linha só). */
const STATUS_SEGS = [
  { key: "convidado", Icon: Clock, title: "Aguardando", active: "bg-warning/20 text-warning" },
  { key: "confirmado", Icon: Check, title: "Confirmado", active: "bg-success/20 text-success" },
  { key: "presente", Icon: UserCheck, title: "Presente", active: "bg-success text-white" },
] as const;

const EXPAND_KEY = "sirvo:evt-expand-all";

/** Ícone de status por escalado (uma linha; sem texto). */
function StatusIcon({ status, checkedIn }: { status: SlotPerson["status"]; checkedIn: boolean }) {
  if (status === "presente" || checkedIn) {
    // Presente = selo cheio (verde sólido + pessoa-com-check) — bem distinto do confirmado.
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-white" title="Presente" aria-label="Presente">
        <UserCheck className="size-4" />
      </span>
    );
  }
  if (status === "confirmado") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success" title="Confirmado" aria-label="Confirmado">
        <Check className="size-4" strokeWidth={3} />
      </span>
    );
  }
  if (status === "recusado") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive" title="Recusou" aria-label="Recusou">
        <X className="size-4" strokeWidth={3} />
      </span>
    );
  }
  // convidado / aguardando
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-warning/15 text-warning" title="Aguardando" aria-label="Aguardando">
      <Clock className="size-4" />
    </span>
  );
}

/**
 * Escala do evento — VISÃO ÚNICA (sem modo Ver/Editar). Uma linha por pessoa:
 * status vira ícone; quem gerencia vê stepper/escalar/remover; quem está
 * escalado (qualquer perfil) responde ali mesmo. Equipes recolhíveis.
 */
export function EventTeams({
  eventId,
  startsAt,
  canCheckin,
  teams,
  isAdmin = false,
  availableTeams = [],
}: {
  eventId: string;
  startsAt: string;
  canCheckin: boolean;
  teams: DetailTeam[];
  isAdmin?: boolean;
  availableTeams?: { id: string; name: string; color: string }[];
}) {
  const multi = teams.length > 1;
  const anyManage = teams.some((t) => t.canManage);
  const pendingConfirms = teams
    .filter((t) => t.canManage)
    .reduce((s, t) => s + Math.max(t.assigned - t.confirmed, 0), 0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(teams.map((t) => [t.teamId, !multi])),
  );

  useEffect(() => {
    try {
      const e = localStorage.getItem(EXPAND_KEY);
      const all = e === "1" ? true : e === "0" ? false : !multi;
      setExpanded(Object.fromEntries(teams.map((t) => [t.teamId, all])));
    } catch {
      /* localStorage indisponível — mantém o padrão */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {anyManage ? <ConfirmationAlert eventId={eventId} startsAt={startsAt} pending={pendingConfirms} /> : null}

      {multi ? (
        <div className="px-1">
          <button onClick={() => setAll(!allExpanded)} className="press-sm text-sm font-bold text-primary">
            {allExpanded ? "Recolher tudo" : "Expandir tudo"}
          </button>
        </div>
      ) : null}

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
              {isAdmin ? (
                <RemoverEquipeButton eventId={eventId} teamId={team.teamId} teamName={team.name} assigned={team.assigned} />
              ) : null}
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
                  <li key={pos.positionId} className="p-3.5">
                    <PositionRow eventId={eventId} startsAt={startsAt} team={team} pos={pos} canCheckin={canCheckin} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}

      {isAdmin && availableTeams.length > 0 ? (
        <div className="px-1 pt-1">
          <AdicionarEquipe eventId={eventId} teams={availableTeams} />
        </div>
      ) : null}
    </div>
  );
}

function PositionRow({
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
  const canManage = team.canManage;
  const notApplicable = pos.status === "not_applicable";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={cn("min-w-0 truncate text-sm font-semibold", notApplicable && "text-muted-foreground")}>
          {pos.positionName}
        </p>
        {canManage ? (
          <NecessarioStepper
            requirementId={pos.requirementId!}
            eventId={eventId}
            teamId={team.teamId}
            needed={pos.needed}
            notApplicable={notApplicable}
          />
        ) : null}
      </div>

      {notApplicable ? null : (
        <div className="space-y-1.5">
          {pos.filled.map((person) => (
            <PersonRow
              key={person.assignmentId}
              eventId={eventId}
              startsAt={startsAt}
              team={team}
              person={person}
              canManage={canManage}
              canCheckin={canCheckin}
            />
          ))}

          {canManage && pos.openCount > 0 ? (
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

/**
 * Uma pessoa escalada em uma linha: avatar · nome · ícone de status · caret.
 * O gestor vê um caret (▾) que abre, INLINE abaixo da linha (sem modal
 * aninhado), TUDO em uma linha só: "Status" + os 3 símbolos (aguardando ·
 * confirmado · presente) e, à direita, WhatsApp + remover. A própria pessoa
 * vê suas ações (responder / check-in).
 */
function PersonRow({
  eventId,
  startsAt,
  team,
  person,
  canManage,
  canCheckin,
}: {
  eventId: string;
  startsAt: string;
  team: DetailTeam;
  person: SlotPerson;
  canManage: boolean;
  canCheckin: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, start] = useTransition();

  const isMe = person.isMe;
  const status = person.status;
  const refused = status === "recusado";
  const canRespond = isMe && !person.swap && (status === "convidado" || status === "confirmado");
  const showSelfCheckin = isMe && canCheckin && !refused && (status === "confirmado" || status === "presente");
  const manageOther = canManage && !isMe;

  function setStatus(novo: "convidado" | "confirmado" | "presente") {
    if (novo === status) return;
    start(async () => {
      const r = await definirStatusEscala(person.assignmentId, team.teamId, eventId, novo);
      if (r.ok) router.refresh();
      else if (typeof window !== "undefined") window.alert(r.error);
    });
  }

  function remover() {
    if (typeof window !== "undefined" && !window.confirm(`Remover ${person.name} da escala?`)) return;
    start(async () => {
      const r = await removerEscalacao(person.assignmentId, eventId, team.teamId);
      if (r.ok) {
        setMenuOpen(false);
        router.refresh();
      } else if (typeof window !== "undefined") {
        window.alert(r.error);
      }
    });
  }

  return (
    <div className="rounded-xl bg-muted/25 px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <Avatar name={person.name} src={person.avatarUrl} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">
            {person.name}
            {isMe ? <span className="text-muted-foreground"> (você)</span> : null}
          </p>
          {refused && person.declineReason ? (
            <p className="truncate text-[11px] text-muted-foreground">Recusou: {person.declineReason}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StatusIcon status={status} checkedIn={person.checkedIn} />
          {isMe ? (
            <>
              {canRespond ? (
                <AssignmentResponse assignmentId={person.assignmentId} status={status} teamId={team.teamId} />
              ) : null}
              {showSelfCheckin ? (
                <CheckinButton
                  assignmentId={person.assignmentId}
                  teamId={team.teamId}
                  eventId={eventId}
                  checkedIn={person.checkedIn}
                  canMark
                  self
                />
              ) : null}
            </>
          ) : manageOther ? (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Opções"
              className="press-sm grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <ChevronDown className={cn("size-5 transition-transform", menuOpen && "rotate-180")} />
            </button>
          ) : null}
        </div>
      </div>

      {manageOther && menuOpen ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
              {STATUS_SEGS.map(({ key, Icon, title, active }) => {
                const on = status === key;
                // "presente" nunca sem confirmar antes.
                const disabled = pending || (key === "presente" && status === "convidado");
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    disabled={disabled}
                    aria-pressed={on}
                    title={key === "presente" && status === "convidado" ? "Confirme primeiro" : title}
                    className={cn(
                      "press-sm grid size-8 place-items-center rounded-full transition-colors disabled:opacity-30",
                      on ? active : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={key === "confirmado" ? 3 : 2} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {person.phone && !refused ? (
              <WhatsAppButton
                phone={person.phone}
                message={`Oi ${person.name.split(/\s+/)[0]}! Passando pra confirmar sua presença na escala de ${team.name} (${fmtEventWhen(startsAt)}). Consegue? 🙏`}
                label=""
                className="size-8 shrink-0 px-0"
              />
            ) : null}
            <button
              type="button"
              onClick={remover}
              disabled={pending}
              aria-label="Remover da escala"
              className="press-sm grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
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
            canManage={canManage}
          />
        </div>
      ) : null}
    </div>
  );
}
