"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { criarEventoAvulso } from "@/lib/actions";
import type { TeamWithPositions } from "@/lib/data";

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function nextSundayISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 7 : 7 - day));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NovoEventoForm({ teams }: { teams: TeamWithPositions[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("Culto de Domingo");
  const [date, setDate] = useState(nextSundayISO());
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("Templo");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await criarEventoAvulso({
        title,
        date,
        time,
        location,
        teamIds: [...selected],
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(r.eventId ? `/escalas/${r.eventId}` : "/escalas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <Field label="Título">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Culto de Domingo" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Horário">
              <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Local">
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Templo" />
          </Field>
        </CardContent>
      </Card>

      <div>
        <div className="mb-1 flex items-center justify-between px-1">
          <h3 className="text-base font-semibold">Equipes necessárias</h3>
          <span className="text-sm text-muted-foreground">{selected.size} selecionada{selected.size === 1 ? "" : "s"}</span>
        </div>
        <p className="mb-3 px-1 text-sm text-muted-foreground">
          Marque quais equipes vão servir. Cada líder monta a escala da própria equipe
          (posições e quantas pessoas) na tela do evento.
        </p>
        <div className="space-y-2.5">
          {teams.map((team) => {
            const on = selected.has(team.id);
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => toggle(team.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on ? <Check className="size-3.5" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <TeamDot color={team.color} /> {team.name}
                  </p>
                  {team.positions.length > 0 ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Sugestão: {team.positions.map((p) => p.name).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">Sem posições cadastradas ainda</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      <Button size="lg" className="w-full" onClick={submit} disabled={pending || !title.trim() || selected.size === 0}>
        {pending ? "Criando…" : "Criar evento"}
      </Button>
    </div>
  );
}
