"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamDot } from "@/components/coverage-badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { warm } from "@/lib/toasts";
import { criarEventoAvulso } from "@/lib/actions";
import type { TeamWithPositions, EventTemplate } from "@/lib/data";

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const dateTimeInputClass = cn(inputClass, "text-[15px] font-bold tabular-nums");

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

export function NovoEventoForm({
  teams,
  templates,
  initialDate,
}: {
  teams: TeamWithPositions[];
  templates: EventTemplate[];
  initialDate?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate ?? "") ? initialDate! : nextSundayISO(),
  );
  const [time, setTime] = useState("18:00");
  const [callTime, setCallTime] = useState("");
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function applyTemplate(t: EventTemplate) {
    setTitle(t.title);
    if (t.startTime) setTime(t.startTime.slice(0, 5));
    setCallTime(t.callTime ? t.callTime.slice(0, 5) : "");
    setLocation(t.location ?? "");
    setSelected(new Set(t.teams.map((x) => x.id)));
  }

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
        callTime: callTime || undefined,
        location,
        teamIds: [...selected],
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      showToast(warm("eventoCriado"));
      router.push(r.eventId ? `/escalas/${r.eventId}` : "/escalas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-5 p-5">
          {templates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comece de um modelo</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="press-sm flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-left hover:border-primary/40"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <LayoutTemplate className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t.teams.length} equipe{t.teams.length === 1 ? "" : "s"}
                        {t.startTime ? ` · ${t.startTime.slice(0, 5)}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <Field label="Título">
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Culto de Domingo" />
            </Field>
            <Field label="Data">
              <input type="date" className={dateTimeInputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Horário">
              <input type="time" className={dateTimeInputClass} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Chegada da equipe (call) — opcional">
              <input type="time" className={dateTimeInputClass} value={callTime} onChange={(e) => setCallTime(e.target.value)} />
            </Field>
            <Field label="Local">
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Templo" />
            </Field>
          </div>

          <div className="space-y-2 border-t border-border/70 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Equipes que vão servir</h3>
              <span className="text-sm text-muted-foreground">
                {selected.size} selecionada{selected.size === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Cada líder monta a escala da própria equipe (posições e quantas pessoas) depois, na tela do evento.
            </p>
            <div className="space-y-2 pt-1">
              {teams.map((team) => {
                const on = selected.has(team.id);
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggle(team.id)}
                    className={cn(
                      "press-sm flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors",
                      on ? "bg-primary/5 ring-1 ring-primary" : "bg-muted/30 hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
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
                          Posições: {team.positions.map((p) => p.name).join(", ")}
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
        </CardContent>
      </Card>

      {error ? <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-ink">{error}</p> : null}

      <Button size="lg" className="w-full" onClick={submit} disabled={pending || !title.trim() || selected.size === 0}>
        {pending ? "Criando…" : "Criar evento"}
      </Button>
    </div>
  );
}
