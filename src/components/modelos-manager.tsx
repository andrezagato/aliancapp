"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import { criarModelo, excluirModelo } from "@/lib/actions";
import type { EventTemplate } from "@/lib/data";

type TeamOpt = { id: string; name: string; color: string };

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STEPS = ["Nome", "Horário", "Equipes"] as const;

export function ModelosManager({ templates, teams }: { templates: EventTemplate[]; teams: TeamOpt[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(templates.length === 0);

  function onSaved() {
    setEditingId(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {templates.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <ul className="divide-y divide-border/70">
            {templates.map((t) => {
              const editing = editingId === t.id;
              return (
                <li key={t.id} className={cn(editing && "bg-primary/5")}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(editing ? null : t.id);
                    }}
                    className="press-sm flex w-full items-center gap-3 p-3.5 text-left"
                    aria-expanded={editing}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{t.title}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span>{t.startTime ? t.startTime.slice(0, 5) : "sem horário"}</span>
                        <span className="flex items-center gap-1">
                          {t.teams.slice(0, 4).map((tm) => (
                            <TeamDot key={tm.id} color={tm.color} />
                          ))}
                          {t.teams.length > 0 ? `${t.teams.length} equipe${t.teams.length > 1 ? "s" : ""}` : "sem equipe"}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={cn("size-5 shrink-0 text-muted-foreground transition-transform", editing && "rotate-180")}
                    />
                  </button>
                  {editing ? (
                    <div className="border-t border-border/70 p-3.5">
                      <TemplateWizard
                        teams={teams}
                        template={t}
                        onCancel={() => setEditingId(null)}
                        onSaved={onSaved}
                        onDeleted={onSaved}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {creating ? (
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-soft">
          <TemplateWizard
            teams={teams}
            onCancel={templates.length > 0 ? () => setCreating(false) : undefined}
            onSaved={onSaved}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" /> Novo modelo
        </Button>
      )}
    </div>
  );
}

function TemplateWizard({
  teams,
  template,
  onCancel,
  onSaved,
  onDeleted,
}: {
  teams: TeamOpt[];
  template?: EventTemplate;
  onCancel?: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(template?.title ?? "");
  const [time, setTime] = useState(template?.startTime ? template.startTime.slice(0, 5) : "18:00");
  const [callTime, setCallTime] = useState(template?.callTime ? template.callTime.slice(0, 5) : "");
  const [location, setLocation] = useState(template?.location ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(template?.teams.map((t) => t.id) ?? []));
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await criarModelo({
        id: template?.id,
        name,
        time,
        callTime: callTime || undefined,
        location,
        teamIds: [...selected],
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSaved();
    });
  }

  function remove() {
    if (!template) return;
    start(async () => {
      const r = await excluirModelo(template.id);
      if (r.ok) onDeleted?.();
    });
  }

  const canContinue = step === 0 ? name.trim().length > 0 : true;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {STEPS.map((label, i) =>
          i < step ? (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Voltar para ${label}`}
              className="h-1.5 flex-1 rounded-full bg-primary"
            />
          ) : (
            <div key={label} className={cn("h-1.5 flex-1 rounded-full", i === step ? "bg-primary" : "bg-border")} />
          ),
        )}
      </div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
        Passo {step + 1} de {STEPS.length} · {STEPS[step]}
      </p>

      {step === 0 ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nome do modelo</span>
          <input
            autoFocus
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Culto de Domingo"
          />
        </label>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Horário padrão</span>
              <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Chegada da equipe</span>
              <input type="time" className={inputClass} value={callTime} onChange={(e) => setCallTime(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Local padrão</span>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Templo" />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
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
      ) : null}

      {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}

      <div className="flex gap-2">
        {onCancel ? (
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continuar
          </Button>
        ) : (
          <Button className="flex-1" onClick={save} disabled={pending || !name.trim() || selected.size === 0}>
            {pending ? "Salvando…" : template ? "Salvar" : "Criar modelo"}
          </Button>
        )}
      </div>

      {template ? (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="press-sm flex w-full items-center justify-center gap-1.5 pt-1 text-[13px] font-medium text-destructive-ink"
        >
          <Trash2 className="size-3.5" /> Excluir modelo
        </button>
      ) : null}
    </div>
  );
}
