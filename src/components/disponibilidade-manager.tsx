"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, X, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adicionarIndisponibilidade, removerIndisponibilidade } from "@/lib/actions";
import { fmtRangeDate, churchDateISO } from "@/lib/format";
import type { AvailabilityBlock } from "@/lib/data";

type Scheduled = { eventTitle: string; startsAt: string };

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DisponibilidadeManager({
  blocks,
  scheduled,
}: {
  blocks: AvailabilityBlock[];
  scheduled: Scheduled[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ title: string; date: string }[]>([]);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  function computeConflicts() {
    const end = fim || ini;
    return scheduled
      .map((a) => ({ title: a.eventTitle, date: churchDateISO(a.startsAt) }))
      .filter((a) => a.date && a.date >= ini && a.date <= end);
  }

  function attempt() {
    setError(null);
    if (!ini) {
      setError("Escolha ao menos uma data.");
      return;
    }
    const c = computeConflicts();
    if (c.length > 0 && !awaitingConfirm) {
      setConflicts(c);
      setAwaitingConfirm(true);
      return;
    }
    doAdd();
  }

  function doAdd() {
    start(async () => {
      const r = await adicionarIndisponibilidade(ini, fim || ini, reason);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setIni("");
      setFim("");
      setReason("");
      setConflicts([]);
      setAwaitingConfirm(false);
      router.refresh();
    });
  }

  function cancelConfirm() {
    setAwaitingConfirm(false);
    setConflicts([]);
  }

  function remove(id: string) {
    start(async () => {
      const r = await removerIndisponibilidade(id);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-medium">Marcar um período que não posso</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">De</span>
              <input
                type="date"
                className={inputClass}
                value={ini}
                onChange={(e) => {
                  setIni(e.target.value);
                  cancelConfirm();
                }}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Até (opcional)</span>
              <input
                type="date"
                className={inputClass}
                value={fim}
                min={ini}
                onChange={(e) => {
                  setFim(e.target.value);
                  cancelConfirm();
                }}
              />
            </label>
          </div>
          <input
            className={inputClass}
            placeholder="Motivo (opcional) — ex.: viagem"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {awaitingConfirm ? (
            <div className="space-y-2 rounded-xl bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
                <AlertTriangle className="size-4" /> Você já está escalado nesse período:
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {c.title} · {fmtRangeDate(c.date)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Se marcar indisponível, avise seu líder para remanejar.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={cancelConfirm} disabled={pending}>
                  Voltar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={doAdd} disabled={pending}>
                  {pending ? "Salvando…" : "Marcar mesmo assim"}
                </Button>
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={attempt} disabled={pending || !ini}>
              <Plus className="size-4" /> {pending ? "Salvando…" : "Marcar indisponibilidade"}
            </Button>
          )}
        </CardContent>
      </Card>

      <section>
        <h3 className="mb-2 px-1 text-base font-semibold">Meus períodos</h3>
        {blocks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <CalendarX2 className="size-8 text-primary" />
              <p className="max-w-xs text-balance text-sm text-muted-foreground">
                Você está disponível. Marque acima os dias que não pode servir — o líder vê isso na hora de escalar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-3 p-4">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CalendarX2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {b.startDate === b.endDate
                        ? fmtRangeDate(b.startDate)
                        : `${fmtRangeDate(b.startDate)} – ${fmtRangeDate(b.endDate)}`}
                    </p>
                    {b.reason ? <p className="truncate text-sm text-muted-foreground">{b.reason}</p> : null}
                  </div>
                  <button
                    onClick={() => remove(b.id)}
                    disabled={pending}
                    aria-label="Remover"
                    className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
