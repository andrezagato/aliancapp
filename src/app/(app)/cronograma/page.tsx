import Link from "next/link";
import { CalendarDays, ChevronRight, ChevronLeft } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { RundownGrid } from "@/components/rundown-grid";
import { getSession } from "@/lib/auth";
import { listarCandidatosDeRoteiro, escolherCulto, ehDeHoje, getEventRundown, listRundownKinds, listRundownTemplates, estouEscaladoNoEvento, getPastaEvento, getStageMessage, listStageShortcuts } from "@/lib/data";
import { fmtWeekdayShort, fmtDayMonthShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function CronogramaPage({ searchParams }: { searchParams: Promise<{ ev?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { ev: evParam } = await searchParams;

  // Próximos + cultos com roteiro aberto que já passaram (senão o líder não
  // consegue mais encerrar e a avaliação nunca é liberada). "Ao vivo" primeiro.
  const candidatos = await listarCandidatosDeRoteiro(session);
  const idx = escolherCulto(candidatos, evParam);
  const escolha = idx >= 0 ? candidatos[idx] : null;
  const ev = escolha?.ev ?? null;
  const state = escolha ? { startedAt: escolha.startedAt, endedAt: escolha.endedAt } : null;
  const [rundown, kinds, templates] = ev
    ? await Promise.all([getEventRundown(ev.id), listRundownKinds(), listRundownTemplates()])
    : [[], await listRundownKinds(), []];

  // O ENCERRADO DE HOJE FICA. Até 09/08 o seletor descartava todo culto
  // encerrado, e no dia em que a Produção encerrou o culto por engano ele
  // evaporou da tela inteira — de onde saiu o "apagaram o culto" e, logo em
  // seguida, o trabalho em cima do roteiro do domingo seguinte. Some só o que já
  // passou de verdade; o de hoje continua à mão, com a faixa de reabrir.
  const visiveis = candidatos.filter((c) => !c.endedAt || ehDeHoje(c.ev.starts_at) || c.ev.id === ev?.id);
  const encerradosAntigos = candidatos.filter((c) => c.endedAt && !ehDeHoje(c.ev.starts_at));
  const activePos = ev ? visiveis.findIndex((c) => c.ev.id === ev.id) : -1;
  const prevEv = activePos > 0 ? visiveis[activePos - 1].ev : null;
  const nextEv = activePos >= 0 && activePos < visiveis.length - 1 ? visiveis[activePos + 1].ev : null;
  // Estrutura: só admin + Produção (equipe manages_rundown). Conteúdo (link/info
  // por bloco): quem está escalado no evento.
  const canEdit = session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);
  const canContribute = ev ? await estouEscaladoNoEvento(session, ev.id) : false;
  const filesUrl = ev ? await getPastaEvento(ev.id) : null;
  // Mensagem no telão (0050): é por IGREJA, não por bloco nem por culto — quem
  // manda pode estar olhando um roteiro e a mensagem valer pro palco de agora.
  const [stageMsg, stageAtalhos] = await Promise.all([
    getStageMessage(session.profile.church_id),
    canEdit ? listStageShortcuts(session.profile.church_id) : Promise.resolve([]),
  ]);

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
                {visiveis.map((c) => {
                  const e = c.ev;
                  const on = e.id === ev.id;
                  const aoVivo = !!c.startedAt && !c.endedAt;
                  return (
                    <Link
                      key={e.id}
                      href={`/cronograma?ev=${e.id}`}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "flex shrink-0 snap-start flex-col rounded-2xl border px-3.5 py-2",
                        on ? "border-primary bg-primary/10" : "border-border bg-card",
                        c.endedAt && !on && "opacity-70",
                      )}
                    >
                      <span className={cn("max-w-[11rem] truncate text-[13px] font-bold", on ? "text-primary" : "text-foreground")}>
                        {e.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] capitalize text-muted-foreground">
                        {fmtWeekdayShort(e.starts_at)} · {fmtDayMonthShort(e.starts_at)}
                        {/* O estado vai em FORMA antes de texto (ponto pulsando /
                            traço), pra distinguir de relance sem depender de cor. */}
                        {aoVivo ? (
                          <span className="inline-flex items-center gap-1 font-bold normal-case text-destructive-ink">
                            <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                            ao vivo
                          </span>
                        ) : c.endedAt ? (
                          <span className="font-bold normal-case">· encerrado</span>
                        ) : null}
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
                meId={session.userId}
                stageMsg={stageMsg}
                stageAtalhos={stageAtalhos}
                filesUrl={filesUrl}
                escalaHref={`/escalas/${ev.id}`}
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
                {encerradosAntigos.length > 0 ? "Tudo em dia por aqui" : "Nenhum culto à frente"}
              </h2>
              <p className="max-w-xs text-balance text-sm text-muted-foreground">
                {encerradosAntigos.length > 0
                  ? "Os próximos cultos já foram encerrados. Eles ficam guardados em Finalizados, na aba Escalas."
                  : "Quando houver um próximo culto, a ordem dele aparece aqui — pra você montar o passo a passo."}
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
