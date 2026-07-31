import { AlertTriangle, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AbrirEscala } from "@/components/event/abrir-escala";
import { cn } from "@/lib/utils";
import { fmtEventWhen } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

const GREEN = "hsl(145 63% 45%)";
const AMBER = "hsl(43 96% 56%)";
const RED = "hsl(6 84% 62%)";

/**
 * Herói de cobertura do evento: anel SEGMENTADO (verde = confirmados, amarelo =
 * escalados que ainda não confirmaram, vermelho = vagas em aberto) + chips por
 * equipe. Quando o culto está a menos de 2 dias e ainda não está 100%
 * confirmado, mostra um alerta forte. Usado pro próximo evento do líder e pro
 * responsável do culto.
 */
export function NextEventHero({
  ev,
  kicker = "Próximo culto",
}: {
  ev: EventListItem;
  kicker?: string;
  caption?: string;
}) {
  const needed = ev.neededTotal;
  const confirmed = ev.confirmedTotal;
  const assigned = ev.assignedTotal;
  const pending = Math.max(assigned - confirmed, 0); // escalados sem confirmar
  const open = Math.max(needed - assigned, 0); // vagas
  const denom = needed > 0 ? needed : 1;
  const c1 = (confirmed / denom) * 100;
  const c2 = ((confirmed + pending) / denom) * 100;
  const done = needed > 0 && confirmed >= needed;

  const ring =
    needed === 0
      ? "hsl(0 0% 100% / 0.18)"
      : `conic-gradient(${GREEN} 0 ${c1}%, ${AMBER} ${c1}% ${c2}%, ${RED} ${c2}% 100%)`;

  const hoursTo = (new Date(ev.starts_at).getTime() - Date.now()) / 36e5;
  const urgent = needed > 0 && confirmed < needed && hoursTo >= 0 && hoursTo <= 48;

  const gaps: string[] = [];
  if (pending > 0) gaps.push(`${pending} aguardando`);
  if (open > 0) gaps.push(`${open} vaga${open > 1 ? "s" : ""}`);

  return (
    <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-primary to-[hsl(349_74%_19%)] p-5 text-primary-foreground shadow-lift">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-70"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.45), transparent 70%)" }}
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{ev.title}</h2>
        <p className="mt-0.5 text-sm text-primary-foreground/80">
          <span className="capitalize">{fmtEventWhen(ev.starts_at)}</span>
          {ev.location ? ` · ${ev.location}` : ""}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-full" style={{ background: ring }}>
            <span className="grid size-10 place-items-center rounded-full bg-[hsl(349_74%_17%)] text-xs font-bold tabular-nums">
              {done ? <Check className="size-5 text-white" strokeWidth={3} /> : `${confirmed}/${needed}`}
            </span>
          </div>
          <div className="min-w-0 text-xs leading-tight">
            <p className="font-bold text-white">
              {confirmed} confirmado{confirmed === 1 ? "" : "s"}
            </p>
            <p className="text-primary-foreground/80">{gaps.length > 0 ? gaps.join(" · ") : "tudo pronto 🎉"}</p>
          </div>
          <AbrirEscala
            eventId={ev.id}
            className={cn(buttonVariants({ variant: "accent", size: "sm" }), "ml-auto press shrink-0")}
          >
            Abrir escala
          </AbrirEscala>
        </div>

        {urgent ? (
          <AbrirEscala
            eventId={ev.id}
            className="press mt-3 flex items-center gap-2 rounded-[14px] border border-white/25 bg-white/15 px-3.5 py-2.5 text-sm font-bold text-white"
          >
            <AlertTriangle className="size-4 shrink-0 text-accent" strokeWidth={2.4} />
            <span className="min-w-0 flex-1">
              Faltam {needed - confirmed} confirmaç{needed - confirmed > 1 ? "ões" : "ão"} e o culto é em breve
            </span>
            <span className="shrink-0 text-accent">Resolver ›</span>
          </AbrirEscala>
        ) : null}

        {ev.teams.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ev.teams.map((t) => (
              <span
                key={t.teamId}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: t.tone === "full" ? GREEN : t.tone === "partial" ? AMBER : RED }}
                />
                {t.name} {t.confirmed}/{t.needed}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
