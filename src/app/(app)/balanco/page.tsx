import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, Users } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { EmptyState } from "@/components/empty-state";
import { getSession } from "@/lib/auth";
import { getManageableTeams, listTeamMonthAssignments } from "@/lib/data";
import { churchDateISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}
/** "DD/MM" na data local da igreja. */
function dm(iso: string): string {
  const d = churchDateISO(iso);
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

type Entry = { startsAt: string; positionName: string; teammates: string[] };
type RosterRow = { positionName: string; profileName: string; avatarUrl: string | null };
type View = "pessoa" | "data";

/**
 * Balanço do mês (por equipe). Duas lentes da MESMA informação (aba):
 *  - Por pessoa: quantas vezes cada um serviu (+ quem ainda não foi escalado) e,
 *    expandindo, quando/posição/com quem.
 *  - Por data: cada evento do mês e, expandindo, a composição (posição · pessoa).
 * Mobile-first, tudo por URL (server). Uma equipe por vez.
 */
export default async function BalancoPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; m?: string; ver?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "volunteer") redirect("/inicio");
  const sp = await searchParams;
  const ver: View = sp.ver === "data" ? "data" : "pessoa";

  const teams = await getManageableTeams(session);
  if (teams.length === 0) {
    return (
      <>
        <TopBar title="Balanço do mês" subtitle="Distribuição por equipe" userName={session.profile.full_name || "?"} />
        <div className="animate-fade-in py-3">
          <EmptyState
            icon={<Users className="size-7" />}
            title="Nenhuma equipe pra você"
            description="Você ainda não gerencia equipes."
          />
        </div>
      </>
    );
  }

  const selected = teams.find((t) => t.id === sp.team) ?? teams[0];

  const todayISO = churchDateISO(new Date().toISOString());
  const monthStr = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : todayISO.slice(0, 7);
  const y = Number(monthStr.slice(0, 4));
  const m = Number(monthStr.slice(5, 7));
  const fromIso = new Date(`${y}-${pad(m)}-01T00:00:00-03:00`).toISOString();
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const toIso = new Date(`${ny}-${pad(nm)}-01T00:00:00-03:00`).toISOString();
  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const nextM = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;

  const assigns = await listTeamMonthAssignments(selected.id, fromIso, toIso);

  // Roster por evento (base das duas lentes).
  const rosterByEvent = new Map<string, typeof assigns>();
  for (const a of assigns) {
    const arr = rosterByEvent.get(a.eventId) ?? [];
    arr.push(a);
    rosterByEvent.set(a.eventId, arr);
  }

  // --- POR PESSOA ---
  const person = new Map<string, { name: string; avatarUrl: string | null; entries: Entry[] }>();
  for (const a of assigns) {
    const mates = Array.from(
      new Map(
        (rosterByEvent.get(a.eventId) ?? [])
          .filter((x) => x.profileId !== a.profileId)
          .map((x) => [x.profileId, x.profileName] as const),
      ).values(),
    );
    const p = person.get(a.profileId) ?? { name: a.profileName, avatarUrl: a.avatarUrl, entries: [] };
    p.entries.push({ startsAt: a.startsAt, positionName: a.positionName, teammates: mates });
    person.set(a.profileId, p);
  }
  const scheduled = Array.from(person.entries())
    .map(([profileId, p]) => ({
      profileId,
      name: p.name,
      avatarUrl: p.avatarUrl,
      count: p.entries.length,
      entries: p.entries.slice().sort((e1, e2) => e1.startsAt.localeCompare(e2.startsAt)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const scheduledIds = new Set(scheduled.map((s) => s.profileId));
  const zeroed = selected.members.filter((mem) => !scheduledIds.has(mem.profileId));
  const max = Math.max(1, ...scheduled.map((s) => s.count));

  // --- POR DATA ---
  const byDate = Array.from(
    assigns
      .reduce((mapAcc, a) => {
        const ev =
          mapAcc.get(a.eventId) ??
          { eventId: a.eventId, startsAt: a.startsAt, title: a.eventTitle, rows: [] as RosterRow[] };
        ev.rows.push({ positionName: a.positionName, profileName: a.profileName, avatarUrl: a.avatarUrl });
        mapAcc.set(a.eventId, ev);
        return mapAcc;
      }, new Map<string, { eventId: string; startsAt: string; title: string; rows: RosterRow[] }>())
      .values(),
  ).sort((e1, e2) => e1.startsAt.localeCompare(e2.startsAt));
  for (const ev of byDate) {
    ev.rows.sort((a, b) => a.positionName.localeCompare(b.positionName, "pt-BR") || a.profileName.localeCompare(b.profileName, "pt-BR"));
  }

  const link = (params: { team?: string; m?: string; ver?: View }) =>
    `/balanco?team=${params.team ?? selected.id}&m=${params.m ?? monthStr}&ver=${params.ver ?? ver}`;

  return (
    <>
      <TopBar title="Balanço do mês" subtitle="Quem serviu quanto — e com quem" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        {/* Seletor de equipe (rolável) */}
        {teams.length > 1 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {teams.map((t) => {
              const on = t.id === selected.id;
              return (
                <Link
                  key={t.id}
                  href={link({ team: t.id })}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                    on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
                  )}
                >
                  <TeamDot color={t.color} className="size-2.5" />
                  {t.name}
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* Navegação de mês */}
        <div className="flex items-center justify-between">
          <Link href={link({ m: prevM })} aria-label="Mês anterior" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-5" />
          </Link>
          <h2 className="text-lg font-semibold capitalize">{monthLabel(y, m)}</h2>
          <Link href={link({ m: nextM })} aria-label="Próximo mês" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted">
            <ChevronRight className="size-5" />
          </Link>
        </div>

        {/* Aba: por pessoa / por data */}
        <div className="flex gap-1 rounded-2xl bg-muted/60 p-1">
          <Link
            href={link({ ver: "pessoa" })}
            className={cn(
              "flex-1 rounded-xl py-2 text-center text-[13px] font-bold",
              ver === "pessoa" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Por pessoa
          </Link>
          <Link
            href={link({ ver: "data" })}
            className={cn(
              "flex-1 rounded-xl py-2 text-center text-[13px] font-bold",
              ver === "data" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Por data
          </Link>
        </div>

        <p className="px-1 text-sm text-muted-foreground">
          {selected.name} · {assigns.length} escalaç{assigns.length === 1 ? "ão" : "ões"} · {byDate.length} evento{byDate.length === 1 ? "" : "s"} no mês · toque pra abrir
        </p>

        {ver === "pessoa" ? (
          <>
            {/* Ainda não escalados no mês */}
            {zeroed.length > 0 ? (
              <Card className="border-warning/30 bg-warning/5 p-4">
                <p className="mb-2 text-sm font-bold text-warning-ink">Ainda não escalados · {zeroed.length}</p>
                <div className="flex flex-wrap gap-2">
                  {zeroed.map((r) => (
                    <span key={r.profileId} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-sm">
                      <Avatar name={r.name} src={r.avatarUrl} className="size-6" />
                      {r.name}
                    </span>
                  ))}
                </div>
              </Card>
            ) : null}

            {/* Escalados — barra + detalhe (dia · posição · com quem) */}
            <Card className="divide-y divide-border">
              {scheduled.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Ninguém escalado nesse mês ainda.</p>
              ) : (
                scheduled.map((r) => (
                  <details key={r.profileId} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                      <Avatar name={r.name} src={r.avatarUrl} className="size-9" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{r.name}</span>
                          <span className="shrink-0 text-sm font-bold text-primary">{r.count}×</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
                        </div>
                      </div>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="space-y-1.5 px-3 pb-3 pl-[60px]">
                      {r.entries.map((e, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{dm(e.startsAt)}</span>
                          <span className="text-muted-foreground"> · {e.positionName}</span>
                          {e.teammates.length > 0 ? (
                            <span className="text-muted-foreground"> · com {e.teammates.join(", ")}</span>
                          ) : (
                            <span className="text-muted-foreground"> · sozinho(a) na equipe</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))
              )}
            </Card>
          </>
        ) : (
          /* POR DATA — cada evento, expandindo a composição (posição · pessoa) */
          <Card className="divide-y divide-border">
            {byDate.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhum evento com escala nesse mês.</p>
            ) : (
              byDate.map((ev) => (
                <details key={ev.eventId} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-bold text-primary">
                      {dm(ev.startsAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{ev.title}</span>
                      <span className="text-[13px] text-muted-foreground">{ev.rows.length} escalado{ev.rows.length === 1 ? "" : "s"}</span>
                    </div>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="space-y-1.5 px-3 pb-3 pl-[60px]">
                    {ev.rows.map((r, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-muted-foreground">{r.positionName}</span>
                        <span className="font-medium"> · {r.profileName}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            )}
          </Card>
        )}
      </div>
    </>
  );
}
