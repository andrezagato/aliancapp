"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamDot } from "@/components/coverage-badge";
import { listarEquipesPublicas, definirEquipeDesejada } from "@/lib/actions";
import { cn } from "@/lib/utils";

type TeamOpt = { id: string; name: string; color: string; icon: string };

/** Perfil pendente (logou sem convite) escolhe a equipe que quer servir —
 * abre a porta pro líder daquela equipe aprovar (em vez de só o admin). */
export function EscolherEquipeDesejada() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    listarEquipesPublicas().then(setTeams);
  }, []);

  function confirmar() {
    if (!teamId) return;
    setError(null);
    start(async () => {
      const r = await definirEquipeDesejada(teamId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  if (teams.length === 0) return null;

  return (
    <div className="w-full space-y-2 text-left">
      <p className="text-sm font-medium text-foreground">Em qual equipe você quer servir?</p>
      <div className="space-y-2">
        {teams.map((t) => {
          const sel = teamId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamId(t.id)}
              className="flex w-full items-center gap-2 rounded-2xl border border-input bg-card p-3 text-left text-sm font-medium"
            >
              <span
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                  sel ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {sel ? <Check className="size-3.5" /> : null}
              </span>
              <TeamDot color={t.color} /> {t.name}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" onClick={confirmar} disabled={pending || !teamId}>
        {pending ? "Enviando…" : "Confirmar equipe"}
      </Button>
    </div>
  );
}
