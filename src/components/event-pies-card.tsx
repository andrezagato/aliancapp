"use client";

import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtWeekdayShort, fmtDayMonthShort, fmtTime } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * Anel de cobertura de uma equipe no evento. Cheio (confirmado ≥ preciso) vira
 * uma BOLA verde cheia; parcial é um anel âmbar com a fatia; vazio é um anel
 * tracejado vermelho. A fração fica dentro; o nome, embaixo (trunca).
 */
function Pie({ label, confirmed, needed }: { label: string; confirmed: number; needed: number }) {
  const full = needed > 0 && confirmed >= needed;
  const empty = confirmed === 0;
  const pct = needed > 0 ? Math.min(100, Math.round((confirmed / needed) * 100)) : 0;

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      {full ? (
        <div className="grid size-11 place-items-center rounded-full bg-success text-[11px] font-extrabold tabular-nums text-white">
          {confirmed}/{needed}
        </div>
      ) : empty ? (
        <div className="grid size-11 place-items-center rounded-full border-2 border-dashed border-destructive/60 text-[11px] font-bold tabular-nums text-destructive">
          {confirmed}/{needed}
        </div>
      ) : (
        <div
          className="grid size-11 place-items-center rounded-full"
          style={{ background: `conic-gradient(hsl(var(--warning)) ${pct}%, hsl(var(--muted)) ${pct}% 100%)` }}
        >
          <span className="grid size-8 place-items-center rounded-full bg-card text-[11px] font-bold tabular-nums text-warning">
            {confirmed}/{needed}
          </span>
        </div>
      )}
      <span className="w-full truncate text-center text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Card do evento em "grade de pies": status por equipe num relance. O card
 * inteiro abre a escala (toque); quem gerencia (admin/líder) ganha uma
 * engrenagem no topo, ao lado do contador, como atalho pra gerenciar.
 */
export function EventPiesCard({ ev, manage = true }: { ev: EventListItem; manage?: boolean }) {
  const router = useRouter();
  const href = `/escalas/${ev.id}`;
  const done = ev.neededTotal > 0 && ev.confirmedTotal >= ev.neededTotal;
  const go = () => router.push(href);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      className="press block cursor-pointer rounded-2xl border border-border bg-card p-4 text-left shadow-soft"
    >
      <div className="flex items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted py-1.5 text-center">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">{fmtWeekdayShort(ev.starts_at)}</span>
          <span className="font-display text-lg font-extrabold leading-none text-primary">
            {fmtDayMonthShort(ev.starts_at).split(" ")[0]}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{fmtTime(ev.starts_at)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-extrabold leading-tight">{ev.title}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {ev.responsibleName ?? "Sem responsável"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums",
              done ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
            )}
          >
            {ev.confirmedTotal}/{ev.neededTotal}
          </span>
          {manage ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go();
              }}
              aria-label="Gerenciar escala"
              className="press-sm grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-[18px]" />
            </button>
          ) : null}
        </div>
      </div>

      {ev.teams.length > 0 ? (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {ev.teams.map((t) => (
            <Pie key={t.teamId} label={t.name} confirmed={t.confirmed} needed={t.needed} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">Sem equipes escaladas ainda.</p>
      )}
    </div>
  );
}
