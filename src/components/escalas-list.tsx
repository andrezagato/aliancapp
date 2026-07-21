"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { churchDateISO } from "@/lib/format";
import { EventPiesCard } from "@/components/event-pies-card";
import type { EventListItem } from "@/lib/data";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const s = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(y, m - 1, 1)).replace(".", "");
  return `${s[0].toUpperCase()}${s.slice(1)}/${String(y).slice(2)}`;
}

/**
 * Lista de eventos da aba Escalas — mesmo card em "grade de pies" da home, com
 * filtro por mês pra não crescer demais. `canManage` (admin/líder) muda só o
 * texto do botão do card.
 */
export function EscalasList({ events, canManage }: { events: EventListItem[]; canManage: boolean }) {
  const months = useMemo(() => {
    const set = new Set(events.map((e) => churchDateISO(e.starts_at).slice(0, 7)));
    return [...set].sort();
  }, [events]);
  const [month, setMonth] = useState<string>("all");
  const shown = month === "all" ? events : events.filter((e) => churchDateISO(e.starts_at).slice(0, 7) === month);

  return (
    <>
      {months.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["all", ...months].map((k) => (
            <button
              key={k}
              onClick={() => setMonth(k)}
              className={cn(
                "press-sm shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold capitalize",
                month === k ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {k === "all" ? "Todos" : monthLabel(k)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {shown.map((ev) => (
          <EventPiesCard key={ev.id} ev={ev} manage={canManage} />
        ))}
      </div>
    </>
  );
}
