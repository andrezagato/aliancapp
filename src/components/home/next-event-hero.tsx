import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtEventWhen } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * Herói de cobertura do evento: anel de confirmados + chips por equipe com o
 * status de cada uma (verde/âmbar/vermelho = cheia/parcial/vazia — os "buracos").
 * Usado pra quem precisa enxergar as vagas: o responsável do culto (qualquer
 * perfil) ou o admin quando também é responsável.
 */
export function NextEventHero({
  ev,
  kicker = "Próximo culto",
  caption = "confirmados",
}: {
  ev: EventListItem;
  kicker?: string;
  caption?: string;
}) {
  const pct = ev.neededTotal > 0 ? Math.round((ev.assignedTotal / ev.neededTotal) * 100) : 100;
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
          <div
            className="grid size-14 place-items-center rounded-full"
            style={{ background: `conic-gradient(hsl(var(--accent)) ${pct}%, hsl(0 0% 100% / 0.18) 0)` }}
          >
            <span className="grid size-10 place-items-center rounded-full bg-[hsl(349_74%_17%)] text-xs font-bold tabular-nums">
              {ev.assignedTotal}/{ev.neededTotal}
            </span>
          </div>
          <p className="text-xs leading-tight text-primary-foreground/80">
            {caption}
            <br />
            no total
          </p>
          <Link href={`/escalas/${ev.id}`} className={cn(buttonVariants({ variant: "accent", size: "sm" }), "ml-auto press")}>
            Abrir escala
          </Link>
        </div>

        {ev.teams.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ev.teams.map((t) => (
              <span
                key={t.teamId}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    t.tone === "full" ? "bg-success" : t.tone === "partial" ? "bg-warning" : "bg-destructive",
                  )}
                  style={t.tone === "empty" ? { backgroundColor: "hsl(6 80% 66%)" } : undefined}
                />
                {t.name} {t.assigned}/{t.needed}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
