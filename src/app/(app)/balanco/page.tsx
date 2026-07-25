import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { EmptyState } from "@/components/empty-state";
import { getSession } from "@/lib/auth";
import { getManageableTeams, getTeamMonthCounts } from "@/lib/data";
import { churchDateISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/**
 * Balanço do mês (por equipe): quem foi escalado quantas vezes, quem ainda não
 * foi. Mobile-first — seletor de equipe + navegação de mês, tudo por URL (server).
 * A visão "todas as equipes juntas" fica pra depois (por ora, uma equipe por vez).
 */
export default async function BalancoPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; m?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "volunteer") redirect("/inicio");
  const sp = await searchParams;

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

  const counts = await getTeamMonthCounts(selected.id, fromIso, toIso);
  const rows = selected.members
    .map((mem) => ({ ...mem, count: counts[mem.profileId] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const scheduled = rows.filter((r) => r.count > 0);
  const zeroed = rows.filter((r) => r.count === 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const totalSlots = rows.reduce((s, r) => s + r.count, 0);

  const link = (params: { team?: string; m?: string }) =>
    `/balanco?team=${params.team ?? selected.id}&m=${params.m ?? monthStr}`;

  return (
    <>
      <TopBar title="Balanço do mês" subtitle="Quem serviu quanto" userName={session.profile.full_name || "?"} />
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
          <Link
            href={link({ m: prevM })}
            aria-label="Mês anterior"
            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h2 className="text-lg font-semibold capitalize">{monthLabel(y, m)}</h2>
          <Link
            href={link({ m: nextM })}
            aria-label="Próximo mês"
            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>

        <p className="px-1 text-sm text-muted-foreground">
          {selected.name} · {totalSlots} escalaç{totalSlots === 1 ? "ão" : "ões"} no mês
        </p>

        {/* Ainda não escalados no mês */}
        {zeroed.length > 0 ? (
          <Card className="border-warning/30 bg-warning/5 p-4">
            <p className="mb-2 text-sm font-bold text-warning">Ainda não escalados · {zeroed.length}</p>
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

        {/* Escalados — barra proporcional (mais escalados no topo) */}
        <Card className="divide-y divide-border">
          {scheduled.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Ninguém escalado nesse mês ainda.</p>
          ) : (
            scheduled.map((r) => (
              <div key={r.profileId} className="flex items-center gap-3 p-3">
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
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
