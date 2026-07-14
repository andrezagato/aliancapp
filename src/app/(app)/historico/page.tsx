import Link from "next/link";
import { ArrowLeft, BadgeCheck, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { EmptyState } from "@/components/empty-state";
import { getSession } from "@/lib/auth";
import { listRecentHistory } from "@/lib/data";
import { fmtEventDate } from "@/lib/format";

export default async function HistoricoPage() {
  const session = await getSession();
  if (!session) return null;
  const events = await listRecentHistory();

  return (
    <div className="animate-fade-in space-y-4 py-3">
      <Link href="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Perfil
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="text-muted-foreground">Quem serviu nos últimos cultos (das suas equipes).</p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<History className="size-7" />}
          title="Ainda sem histórico"
          description="Depois dos primeiros cultos, aqui fica o registro de quem serviu em cada função — útil pro rodízio."
        />
      ) : (
        <div className="space-y-4">
          {events.map((ev) => (
            <section key={ev.eventId}>
              <h3 className="mb-2 px-1 text-sm font-semibold">
                {ev.title} <span className="font-normal capitalize text-muted-foreground">· {fmtEventDate(ev.startsAt)}</span>
              </h3>
              <Card>
                <ul className="divide-y divide-border">
                  {ev.people.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 p-3 pl-4">
                      <Avatar name={p.name} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <TeamDot color={p.teamColor} /> {p.teamName} · {p.positionName}
                        </p>
                      </div>
                      {p.status === "presente" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <BadgeCheck className="size-3.5" /> presente
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
