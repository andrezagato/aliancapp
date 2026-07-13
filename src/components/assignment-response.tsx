"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { confirmarEscalacao, recusarEscalacao } from "@/lib/actions";
import type { AssignmentStatus } from "@/lib/supabase/database.types";

export function AssignmentResponse({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: AssignmentStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    setError(null);
    start(async () => {
      const r = await confirmarEscalacao(assignmentId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function recusar() {
    setError(null);
    start(async () => {
      const r = await recusarEscalacao(assignmentId, motivo);
      if (!r.ok) setError(r.error);
      else {
        setShowDecline(false);
        setMotivo("");
        router.refresh();
      }
    });
  }

  const declineModal = (
    <Modal open={showDecline} onClose={() => !pending && setShowDecline(false)}>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lift">
        <h3 className="text-lg font-semibold">Não vai dar pra servir?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conta rapidinho o motivo — ajuda o líder a remanejar com antecedência.
        </p>
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ex.: viagem de trabalho nesse fim de semana"
          className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setShowDecline(false)} disabled={pending}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={recusar}
            disabled={pending || motivo.trim().length < 3}
          >
            {pending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </Modal>
  );

  if (status === "confirmado" || status === "presente") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
          <Check className="size-4" /> Confirmado
        </span>
        {status === "confirmado" ? (
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
          >
            Não poderei mais
          </button>
        ) : null}
        {declineModal}
      </div>
    );
  }

  if (status === "recusado") {
    return <span className="text-sm text-muted-foreground">Você recusou</span>;
  }

  if (status === "vaga_aberta") return null;

  // convidado
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <div className="flex gap-2">
        <Button size="sm" onClick={confirmar} disabled={pending}>
          {pending ? "…" : "Confirmar"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowDecline(true)} disabled={pending}>
          Não posso
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {declineModal}
    </div>
  );
}
