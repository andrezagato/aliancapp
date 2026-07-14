"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, BadgeCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fazerCheckin, desfazerCheckin, resolverTroca } from "@/lib/actions";

// -----------------------------------------------------------------------------
// Check-in (presença no dia)
// -----------------------------------------------------------------------------
export function CheckinButton({
  assignmentId,
  teamId,
  eventId,
  checkedIn,
  canMark,
  prominent = false,
}: {
  assignmentId: string;
  teamId: string;
  eventId: string;
  checkedIn: boolean;
  canMark: boolean;
  prominent?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    start(async () => {
      const r = next
        ? await fazerCheckin(assignmentId, teamId, eventId)
        : await desfazerCheckin(assignmentId, teamId, eventId);
      if (r.ok) router.refresh();
    });
  }

  if (checkedIn) {
    if (prominent) {
      return (
        <div className="flex items-center justify-between rounded-xl bg-success/10 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <BadgeCheck className="size-5" /> Presença confirmada
          </span>
          {canMark ? (
            <button
              type="button"
              onClick={() => toggle(false)}
              disabled={pending}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              desfazer
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
          <BadgeCheck className="size-4" /> Presente
        </span>
        {canMark ? (
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={pending}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            desfazer
          </button>
        ) : null}
      </span>
    );
  }

  if (!canMark) return null;

  if (prominent) {
    return (
      <Button className="w-full" onClick={() => toggle(true)} disabled={pending}>
        <BadgeCheck className="size-4" /> {pending ? "…" : "Cheguei — marcar presença"}
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={() => toggle(true)} disabled={pending}>
      <Check className="size-4" /> {pending ? "…" : "Marcar presença"}
    </Button>
  );
}

// -----------------------------------------------------------------------------
// Troca pendente — status + resolver (líder). Só aprova após o substituto aceitar.
// -----------------------------------------------------------------------------
export function SwapPending({
  swapId,
  eventId,
  reason,
  suggestedName,
  acceptedBySub,
  canManage,
}: {
  swapId: string;
  eventId: string;
  reason: string | null;
  suggestedName: string | null;
  acceptedBySub: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function resolve(aprovar: boolean) {
    start(async () => {
      const r = await resolverTroca(swapId, aprovar, eventId);
      if (r.ok) router.refresh();
    });
  }

  const aguardandoSub = !!suggestedName && !acceptedBySub;

  return (
    <div className="rounded-xl bg-warning/10 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
        <ArrowLeftRight className="size-3.5" /> Troca solicitada
      </p>
      {reason ? <p className="mt-0.5 text-xs text-muted-foreground">Motivo: {reason}</p> : null}
      <p className="text-xs text-muted-foreground">
        {suggestedName
          ? acceptedBySub
            ? `${suggestedName} aceitou — falta o líder aprovar`
            : `Aguardando ${suggestedName} aceitar`
          : "Sem substituto sugerido (abre a vaga)"}
      </p>
      {canManage ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => resolve(true)} disabled={pending || aguardandoSub}>
            {pending ? "…" : suggestedName ? "Aprovar troca" : "Abrir vaga"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => resolve(false)} disabled={pending}>
            Recusar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
