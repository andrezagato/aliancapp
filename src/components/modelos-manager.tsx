"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { criarModelo, excluirModelo } from "@/lib/actions";
import type { EventTemplate } from "@/lib/data";

type TeamOpt = { id: string; name: string; color: string };

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ModelosManager({
  templates,
  teams,
}: {
  templates: EventTemplate[];
  teams: TeamOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(templates.length === 0);
  const [name, setName] = useState("");
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function create() {
    setError(null);
    start(async () => {
      const r = await criarModelo({ name, time, location, teamIds: [...selected] });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setName("");
      setLocation("");
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await excluirModelo(id);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Modelos existentes */}
      {templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <LayoutTemplate className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.startTime ? t.startTime.slice(0, 5) : ""}
                    {t.location ? ` · ${t.location}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                    {t.teams.map((tm) => (
                      <span key={tm.id} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <TeamDot color={tm.color} /> {tm.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  disabled={pending}
                  aria-label="Excluir modelo"
                  className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Novo modelo */}
      {open ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-base font-semibold">Novo modelo</p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Nome</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Culto de Domingo" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Horário padrão</span>
                <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Local padrão</span>
                <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Templo" />
              </label>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Equipes que servem</span>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => {
                  const on = selected.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                        on ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {on ? <Check className="size-3.5" /> : <TeamDot color={t.color} />} {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              {templates.length > 0 ? (
                <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
                  Cancelar
                </Button>
              ) : null}
              <Button className="flex-1" onClick={create} disabled={pending || !name.trim() || selected.size === 0}>
                {pending ? "Salvando…" : "Salvar modelo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo modelo
        </Button>
      )}
    </div>
  );
}
