import Link from "next/link";
import { CalendarDays, ChevronRight, ChevronLeft } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { RundownGrid } from "@/components/rundown-grid";
import { EventFilesCard } from "@/components/event-files-card";
import { TeamReview } from "@/components/team-review";
import { getSession } from "@/lib/auth";
import { listUpcomingEvents, getEventRundown, listRundownKinds, listRundownTemplates, getRundownState, estouEscaladoNoEvento, getPastaEvento } from "@/lib/data";
import { fmtWeekdayShort, fmtDayMonthShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function CronogramaPage({ searchParams }: { searchParams: Promise<{ ev?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { ev: evParam } = await searchParams;

  const upcoming = await listUpcomingEvents(session, 8);
  // Encerrados saem: escolhe o primeiro não-encerrado (ou o pedido via ?ev=).
  const states = await Promise.all(upcoming.map((e) => getRundownState(e.id)));
  const firstOpen = upcoming.findIndex((_, i) => !states[i].endedAt);
  const chosen = evParam ? upcoming.findIndex((e) => e.id === evParam) : -1;
  const idx = chosen >= 0 ? chosen : firstOpen;
  const ev = idx >= 0 ? upcoming[idx] : null;
  const state = idx >= 0 ? states[idx] : null;
  const [rundown, kinds, templates] = ev
    ? await Promise.all([getEventRundown(ev.id), listRundownKinds(), listRundownTemplates()])
    : [[], await listRundownKinds(), []];
  const allOpen = upcoming.filter((_, i) => !states[i].endedAt);
  const allEnded = upcoming.filter((_, i) => !!states[i].endedAt);
  const activePos = ev ? allOpen.findIndex((e) => e.id === ev.id) : -1;
  const prevEv = activePos > 0 ? allOpen[activePos - 1] : null;
  const nextEv = activePos >= 0 && activePos < allOpen.length - 1 ? allOpen[activePos + 1] : null;
  // Estrutura: só admin + Produção (equipe manages_rundown). Conteúdo (link/info
  // por bloco): quem está escalado no evento.
  const canEdit = session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);
  const canReview = session.role === "admin" || session.profile.teams.some((t) => t.role === "leader");
  const canContribute = ev ? await estouEscaladoNoEvento(session, ev.id) : false;
  const filesUrl = ev ? await getPastaEvento(ev.id) : null;

  return (
    <>
      <TopBar title="Roteiro" subtitle="A ordem do próximo culto" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-3 py-3">
        {ev ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Cabeçalho = seletor de eventos (desliza na horizontal + setas) */}
            <div className="flex items-center gap-1 border-b border-border bg-primary/[0.06] p-2">
              {prevEv ? (
                <Link
                  href={`/cronograma?ev=${prevEv.id}`}
                  aria-label="Culto anterior"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <ChevronLeft className="size-5" />
                </Link>
              ) : (
                <span className="size-9 shrink-0" />
              )}
              <div className="flex flex-1 snap-x gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {allOpen.map((e) => {
                  const on = e.id === ev.id;
                  return (
                    <Link
                      key={e.id}
                      href={`/cronograma?ev=${e.id}`}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "flex shrink-0 snap-start flex-col rounded-2xl border px-3.5 py-2",
                        on ? "border-primary bg-primary/10" : "border-border bg-card",
                      )}
                    >
                      <span className={cn("max-w-[11rem] truncate text-[13px] font-bold", on ? "text-primary" : "text-foreground")}>
                        {e.title}
                      </span>
                      <span className="text-[11px] capitalize text-muted-foreground">
                        {fmtWeekdayShort(e.starts_at)} · {fmtDayMonthShort(e.starts_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {nextEv ? (
                <Link
                  href={`/cronograma?ev=${nextEv.id}`}
                  aria-label="Próximo culto"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight className="size-5" />
                </Link>
              ) : (
                <span className="size-9 shrink-0" />
              )}
            </div>
            <div className="p-3">
              <RundownGrid
                eventId={ev.id}
                startsAt={ev.starts_at}
                startedAt={state?.startedAt ?? null}
                endedAt={state?.endedAt ?? null}
                items={rundown}
                kinds={kinds}
                templates={templates}
                canEdit={canEdit}
                canContribute={canContribute}
                actions={
                  <EventFilesCard eventId={ev.id} url={filesUrl} canEdit={canEdit} escalaHref={`/escalas/${ev.id}`} />
                }
              />
            </div>
          </div>
        ) : (
          <Card className="border-dashed">
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="size-7" />
              </span>
              <h2 className="font-display text-lg font-bold">
                {allEnded.length > 0 ? "Tudo em dia por aqui" : "Nenhum culto à frente"}
              </h2>
              <p className="max-w-xs text-balance text-sm text-muted-foreground">
                {allEnded.length > 0
                  ? "Os próximos cultos já foram encerrados. Eles ficam guardados em Finalizados, logo abaixo."
                  : "Quando houver um próximo culto, a ordem dele aparece aqui — pra você montar o passo a passo."}
              </p>
            </div>
          </Card>
        )}

        {allEnded.length > 0 ? (
          <details className="group overflow-hidden rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span>Finalizados · {allEnded.length}</span>
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="flex flex-col gap-1 border-t border-border p-2">
              {allEnded.map((e) => (
                <div key={e.id} className="flex items-center gap-1 rounded-xl px-1 hover:bg-muted">
                  <Link href={`/cronograma?ev=${e.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2.5">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{e.title}</span>
                    <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                      {fmtWeekdayShort(e.starts_at)} · {fmtDayMonthShort(e.starts_at)}
                    </span>
                  </Link>
                  {canReview ? (
                    <TeamReview
                      eventId={e.id}
                      triggerClassName="press-sm shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-bold text-primary"
                      trigger="Revisar"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </>
  );
}
