"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";
import { confirmarEscalacao, recusarEscalacao, pedirTroca, listMembrosParaTroca } from "@/lib/actions";
import type { AssignmentStatus } from "@/lib/supabase/database.types";

export function AssignmentResponse({
  assignmentId,
  status,
  teamId,
}: {
  assignmentId: string;
  status: AssignmentStatus;
  teamId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [members, setMembers] = useState<{ profileId: string; name: string; avatarUrl: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    setError(null);
    start(async () => {
      const r = await confirmarEscalacao(assignmentId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  async function openDecline() {
    setShowDecline(true);
    setError(null);
    if (members === null) setMembers(await listMembrosParaTroca(teamId));
  }

  function submitDecline() {
    setError(null);
    start(async () => {
      const r = chosen
        ? await pedirTroca(assignmentId, motivo, chosen)
        : await recusarEscalacao(assignmentId, motivo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShowDecline(false);
      setMotivo("");
      setChosen(null);
      router.refresh();
    });
  }

  const declineModal = (
    <Modal open={showDecline} onClose={() => !pending && setShowDecline(false)}>
      <div className="flex max-h-[80dvh] flex-col rounded-2xl border border-border bg-card shadow-lift">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold">Não vou poder servir</h3>
          <p className="text-sm text-muted-foreground">
            Conta o motivo. Se quiser, sugira alguém pra te substituir — a pessoa confirma e o líder aprova.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Ex.: viagem nesse fim de semana"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div>
            <p className="mb-1.5 text-sm font-medium">Sugerir substituto (opcional)</p>
            {members === null ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém mais na equipe pra sugerir.</p>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.profileId}>
                    <button
                      type="button"
                      onClick={() => setChosen(chosen === m.profileId ? null : m.profileId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2 text-left",
                        chosen === m.profileId ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                      )}
                    >
                      <Avatar name={m.name} src={m.avatarUrl} className="size-8" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
                      {chosen === m.profileId ? <Check className="size-4 text-primary" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex gap-2 border-t border-border p-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowDecline(false)} disabled={pending}>
            Voltar
          </Button>
          <Button
            variant={chosen ? "primary" : "destructive"}
            className="flex-1"
            onClick={submitDecline}
            disabled={pending || motivo.trim().length < 3}
          >
            {pending ? "Enviando…" : chosen ? "Pedir troca" : "Não vou poder"}
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
            onClick={openDecline}
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
        <Button size="sm" variant="outline" onClick={openDecline} disabled={pending}>
          Não posso
        </Button>
      </div>
      {error && !showDecline ? <p className="text-xs text-destructive">{error}</p> : null}
      {declineModal}
    </div>
  );
}
