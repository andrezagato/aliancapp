import { Plus } from "lucide-react";
import { AbrirEscala } from "@/components/event/abrir-escala";
import { TeamDot } from "@/components/coverage-badge";
import { fmtEventWhen } from "@/lib/format";
import type { EventListItem } from "@/lib/data";

/**
 * "Escala de hoje" (Fase 5 do pós-audit, padrão 7a) — faixa colapsada das
 * equipes prontas + grade das que faltam, com "+" pra ir direto escalar.
 */
export function EscalaHojeCard({ event, isToday }: { event: EventListItem; isToday: boolean }) {
  const comVagas = event.teams.filter((t) => t.needed > 0);
  const prontas = comVagas.filter((t) => t.confirmed >= t.needed);
  const faltam = comVagas
    .filter((t) => t.confirmed < t.needed)
    .sort((a, b) => b.needed - b.confirmed - (a.needed - a.confirmed));

  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">{isToday ? "Escala de hoje" : "Próxima escala"}</h3>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <AbrirEscala eventId={event.id} className="block w-full p-4 text-left hover:bg-muted/40">
          <p className="font-semibold">{event.title}</p>
          <p className="text-sm text-muted-foreground">{fmtEventWhen(event.starts_at)}</p>
        </AbrirEscala>

        {prontas.length > 0 ? (
          <details className="border-t border-border">
            <summary className="cursor-pointer bg-success/10 px-4 py-2.5 text-sm font-semibold text-success-ink">
              {prontas.length} {prontas.length > 1 ? "equipes prontas" : "equipe pronta"}
            </summary>
            <ul className="divide-y divide-border/70 border-t border-border">
              {prontas.map((t) => (
                <li key={t.teamId} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <TeamDot color={t.color} /> {t.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t.confirmed}/{t.needed}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {faltam.length > 0 ? (
          <div className="border-t border-border p-3">
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Faltam {faltam.length} {faltam.length > 1 ? "equipes" : "equipe"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {faltam.map((t) => (
                <AbrirEscala
                  key={t.teamId}
                  eventId={event.id}
                  className="flex items-center gap-2 rounded-[14px] border border-dashed border-warning/50 bg-warning/5 p-3 text-left"
                >
                  <TeamDot color={t.color} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-warning-ink">
                    <Plus className="size-3.5" /> {t.confirmed}/{t.needed}
                  </span>
                </AbrirEscala>
              ))}
            </div>
          </div>
        ) : null}

        {prontas.length === 0 && faltam.length === 0 ? (
          <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">
            Sem equipes escaladas ainda.
          </p>
        ) : null}
      </div>
    </section>
  );
}
