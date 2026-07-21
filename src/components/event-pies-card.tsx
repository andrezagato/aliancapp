import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtEventWhen } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * Anel de cobertura de uma equipe no evento. Cheio (confirmado ≥ preciso) vira
 * uma BOLA verde cheia; parcial é um anel âmbar com a fatia; vazio é um anel
 * tracejado vermelho. A fração fica dentro; o nome, embaixo (trunca).
 */
function Pie({ label, confirmed, needed, href }: { label: string; confirmed: number; needed: number; href: string }) {
  const full = needed > 0 && confirmed >= needed;
  const empty = confirmed === 0;
  const pct = needed > 0 ? Math.min(100, Math.round((confirmed / needed) * 100)) : 0;

  return (
    <Link href={href} className="press-sm flex min-w-0 flex-col items-center gap-1">
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
    </Link>
  );
}

/** Card do evento em "grade de pies" (visão do admin): status por equipe num relance. */
export function EventPiesCard({ ev }: { ev: EventListItem }) {
  const href = `/escalas/${ev.id}`;
  const done = ev.neededTotal > 0 && ev.confirmedTotal >= ev.neededTotal;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[18px] font-extrabold leading-tight">{ev.title}</p>
          <p className="truncate text-[12.5px] capitalize text-muted-foreground">
            {fmtEventWhen(ev.starts_at)} · {ev.responsibleName ?? "Sem responsável"}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums",
            done ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          {ev.confirmedTotal}/{ev.neededTotal}
        </span>
      </div>

      {ev.teams.length > 0 ? (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {ev.teams.map((t) => (
            <Pie key={t.teamId} label={t.name} confirmed={t.confirmed} needed={t.needed} href={href} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">Sem equipes escaladas ainda.</p>
      )}

      <Link
        href={href}
        className="press mt-4 block rounded-2xl bg-primary py-3 text-center text-sm font-extrabold text-primary-foreground"
      >
        {done ? "Ver escala" : "Escalar equipes faltantes"}
      </Link>
    </div>
  );
}
