"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { criarInteresse, resolverInteresse } from "@/lib/actions";
import type { TeamWithPositions } from "@/lib/data";

// -----------------------------------------------------------------------------
// Voluntário sinaliza interesse
// -----------------------------------------------------------------------------
export function InteresseButton({ teams }: { teams: TeamWithPositions[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const team = teams.find((t) => t.id === teamId) ?? null;

  function submit() {
    if (!teamId) return;
    setError(null);
    start(async () => {
      const r = await criarInteresse(teamId, positionId, note);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setTeamId(null);
      setPositionId(null);
      setNote("");
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
          <p className="text-sm text-muted-foreground">Sinalize seu interesse — o líder recebe.</p>
        </div>
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)}>
        <div className="flex max-h-[80dvh] flex-col rounded-2xl border border-border bg-card shadow-lift">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold">Tenho interesse em servir</h3>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">Equipe</p>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTeamId(t.id);
                      setPositionId(null);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                      teamId === t.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    <TeamDot color={t.color} /> {t.name}
                  </button>
                ))}
              </div>
            </div>

            {team && team.positions.length > 0 ? (
              <div>
                <p className="mb-1.5 text-sm font-medium">Função (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {team.positions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPositionId(positionId === p.id ? null : p.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        positionId === p.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Quer contar algo? (opcional)"
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
// Líder resolve um interesse
// -----------------------------------------------------------------------------
export function InteresseResolveButtons({ id, teamId }: { id: string; teamId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(status: "atendido" | "arquivado") {
    start(async () => {
      const r = await resolverInteresse(id, status, teamId);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="ghost" onClick={() => run("arquivado")} disabled={pending}>
        Arquivar
      </Button>
      <Button size="sm" variant="outline" onClick={() => run("atendido")} disabled={pending}>
        Atendi
      </Button>
    </div>
  );
}
