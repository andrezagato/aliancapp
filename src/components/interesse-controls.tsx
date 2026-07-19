"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { criarInteresse, responderInteresse } from "@/lib/actions";
import type { TeamWithPositions } from "@/lib/data";

// -----------------------------------------------------------------------------
// Voluntário sinaliza interesse
// -----------------------------------------------------------------------------
export function InteresseButton({ teams }: { teams: TeamWithPositions[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const team = teams.find((t) => t.id === teamId) ?? null;

  function submit() {
    if (!teamId) return;
    setError(null);
    start(async () => {
      const r = await criarInteresse(teamId, null, note);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setTeamId(null);
      setNote("");
      showToast("Interesse enviado! A liderança já foi avisada. 🙌");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/40 p-4 text-left hover:bg-accent/5"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="font-medium">Quero servir em outra equipe</p>
          <p className="text-sm text-muted-foreground">Sinalize seu interesse — a liderança recebe.</p>
        </div>
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)}>
        <div className="flex max-h-[80dvh] flex-col rounded-2xl border border-border bg-card shadow-lift">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold">Tenho interesse em servir</h3>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Você sinaliza aqui, a liderança recebe e avalia. Se aprovado, você já entra na equipe e passa a receber as
              escalas.
            </p>

            <div>
              <p className="mb-1.5 text-sm font-medium">Em qual equipe?</p>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTeamId(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                      teamId === t.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <TeamDot color={t.color} /> {t.name}
                  </button>
                ))}
              </div>
            </div>

            {team ? (
              <p className="rounded-xl bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
                {team.leaders.length > 0 ? (
                  <>
                    Quem avalia: <span className="font-semibold text-foreground">{team.leaders.join(" e ")}</span>
                  </>
                ) : (
                  "A liderança da equipe vai avaliar seu pedido."
                )}
              </p>
            ) : null}

            <div>
              <p className="mb-1.5 text-sm font-medium">Por que quer servir nesse ministério?</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Conta um pouquinho pra liderança (opcional)"
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={submit} disabled={pending || !teamId}>
              {pending ? "Enviando…" : "Sinalizar interesse"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Líder responde um pedido de servir (aceita/recusa + mensagem)
// -----------------------------------------------------------------------------
export function InteresseResolveButton({
  id,
  teamId,
  personName,
  teamName,
}: {
  id: string;
  teamId: string;
  personName: string;
  teamName: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const respond = (aceitar: boolean) => {
    start(async () => {
      const r = await responderInteresse(id, teamId, aceitar, note);
      if (r.ok) {
        setOpen(false);
        setNote("");
        showToast(aceitar ? `${personName} entrou na equipe! Avisamos a pessoa.` : "Resposta enviada à pessoa.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Responder
      </Button>

      <Modal open={open} onClose={() => !pending && setOpen(false)} sheet title="Responder pedido">
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{personName}</span> quer servir em{" "}
          <span className="font-semibold text-foreground">{teamName}</span>. Deixe uma mensagem — a pessoa recebe junto
          com a resposta.
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Mensagem pra pessoa (opcional)"
          className="mt-3 w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary"
        />

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => respond(false)}
            disabled={pending}
            className="press h-[50px] flex-1 rounded-[14px] border border-destructive/30 bg-card text-[15px] font-bold text-destructive"
          >
            Recusar
          </button>
          <button
            onClick={() => respond(true)}
            disabled={pending}
            className="press h-[50px] flex-1 rounded-[14px] bg-success text-[15px] font-extrabold text-white"
          >
            {pending ? "…" : "Aceitar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
