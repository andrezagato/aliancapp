"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { adicionarIndisponibilidade, removerIndisponibilidade } from "@/lib/actions";
import { churchDateISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailabilityBlock } from "@/lib/data";

type Scheduled = { eventTitle: string; startsAt: string };

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Expande um bloco (start..end inclusive) em dias YYYY-MM-DD, em UTC (datas de calendário, sem drift de fuso). */
function expand(block: AvailabilityBlock): string[] {
  const out: string[] = [];
  const start = new Date(`${block.startDate}T00:00:00Z`);
  const end = new Date(`${block.endDate || block.startDate}T00:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

/**
 * Calendário mensal tocável: cada dia alterna livre ↔ bloqueado. Dias que já
 * estão num período existente vêm marcados. Ao salvar, faz o diff: apaga blocos
 * tocados e re-adiciona (como dias avulsos) os dias ainda desejados — o que
 * também "divide" um período multi-dia sem lógica frágil de range.
 */
export function DisponibilidadeManager({
  blocks,
  scheduled,
}: {
  blocks: AvailabilityBlock[];
  scheduled: Scheduled[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, start] = useTransition();

  const todayISO = churchDateISO(new Date().toISOString());
  const [curY, curM] = [Number(todayISO.slice(0, 4)), Number(todayISO.slice(5, 7)) - 1];

  const initialDays = useMemo(() => {
    const s = new Set<string>();
    for (const b of blocks) for (const d of expand(b)) s.add(d);
    return s;
  }, [blocks]);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set(initialDays));
  useEffect(() => setBlocked(new Set(initialDays)), [initialDays]);

  const scheduledSet = useMemo(
    () => new Set(scheduled.map((s) => churchDateISO(s.startsAt)).filter(Boolean)),
    [scheduled],
  );

  const [view, setView] = useState({ y: curY, m: curM });
  const atCurrentMonth = view.y === curY && view.m === curM;

  const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthPrefix = `${view.y}-${pad(view.m + 1)}`;
  const blockedThisMonth = [...blocked].filter((d) => d.startsWith(monthPrefix)).length;

  function toggle(dayISO: string) {
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(dayISO)) next.delete(dayISO);
      else {
        next.add(dayISO);
        if (scheduledSet.has(dayISO)) showToast("Você está escalado nesse dia — avise seu líder.");
      }
      return next;
    });
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  function save() {
    const toDelete: string[] = [];
    const keptDays = new Set<string>();
    for (const b of blocks) {
      const days = expand(b);
      if (days.some((d) => !blocked.has(d))) toDelete.push(b.id);
      else days.forEach((d) => keptDays.add(d));
    }
    const toAdd = [...blocked].filter((d) => !keptDays.has(d)).sort();
    if (toDelete.length === 0 && toAdd.length === 0) {
      showToast("Nada mudou por aqui.");
      return;
    }
    start(async () => {
      for (const id of toDelete) {
        const r = await removerIndisponibilidade(id);
        if (!r.ok) return showToast(r.error);
      }
      for (const d of toAdd) {
        const r = await adicionarIndisponibilidade(d, d);
        if (!r.ok) return showToast(r.error);
      }
      showToast("Disponibilidade salva.");
      router.refresh();
    });
  }

  const dirty = blocked.size !== initialDays.size || [...blocked].some((d) => !initialDays.has(d));

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-accent/50 bg-gradient-to-br from-accent/25 to-accent/45 p-4 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-foreground">Quando você não pode</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-accent-foreground/80">
          Toque nos dias em que não estará disponível. Seu líder vê isso antes de escalar.
        </p>
      </div>

      <div className="rounded-[22px] border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2 px-1 pb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              disabled={atCurrentMonth}
              aria-label="Mês anterior"
              className="press-sm grid size-8 place-items-center rounded-full text-muted-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="font-display text-[17px] font-bold capitalize text-foreground">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className="press-sm grid size-8 place-items-center rounded-full text-muted-foreground"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          <span className="text-xs font-bold text-muted-foreground">{blockedThisMonth} bloqueados</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-[11px] font-extrabold text-muted-foreground/70">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (day === null) return <span key={`b${i}`} />;
            const dayISO = iso(view.y, view.m, day);
            const isPast = dayISO < todayISO;
            const isBlocked = blocked.has(dayISO);
            const isScheduled = scheduledSet.has(dayISO);
            const isToday = dayISO === todayISO;
            return (
              <button
                key={dayISO}
                onClick={() => toggle(dayISO)}
                disabled={isPast}
                aria-pressed={isBlocked}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-[11px] text-sm font-bold transition-colors",
                  isPast
                    ? "cursor-default text-muted-foreground/30"
                    : isBlocked
                      ? "press-sm bg-destructive text-destructive-foreground"
                      : "press-sm bg-muted text-foreground",
                  isToday && !isBlocked && "ring-1 ring-primary/40",
                )}
              >
                {day}
                {isScheduled ? (
                  <span
                    className={cn(
                      "absolute bottom-1 size-1 rounded-full",
                      isBlocked ? "bg-white/80" : "bg-primary",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[4px] bg-destructive" /> Não posso
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[4px] border border-border bg-muted" /> Livre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" /> Você está escalado
          </span>
        </div>
      </div>

      <button
        onClick={save}
        disabled={pending || !dirty}
        className={cn(
          "press h-[50px] w-full rounded-[15px] text-[15px] font-extrabold transition-opacity",
          dirty ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        {pending ? "Salvando…" : "Salvar disponibilidade"}
      </button>
    </div>
  );
}
