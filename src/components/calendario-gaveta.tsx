"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TeamCalendar } from "@/components/home/team-calendar";
import { NovoEventoWizard } from "@/components/event/novo-evento-wizard";
import { cn } from "@/lib/utils";
import type { TeamOption } from "@/components/event-request-controls";
import type { EventListItem, TeamWithPositions, EventTemplate } from "@/lib/data";

/**
 * O calendário do mês virou GAVETA na aba Escalas — /calendario não existe mais.
 * É a "Regra do Sheet em Vez de Página" do DESIGN.md aplicada a uma tela inteira:
 * menos um carregamento no wi-fi da igreja, e a lista de eventos continua ali
 * embaixo, empurrada, sem perder o lugar.
 *
 * As setas ‹ mês › mudam SÓ a grade. A lista abaixo continua sendo "o que vem
 * por aí" — decisão do dono: quem espia novembro não quer que os próximos
 * eventos desapareçam da tela.
 *
 * Este componente desenha a LINHA DE AÇÕES inteira, e não só o botão, porque o
 * botão e a gaveta compartilham estado e a gaveta precisa nascer FORA do flex da
 * linha (senão ela viraria uma coluna do lado). Os dois vêm num `<div>` único
 * pra que o `space-y-3` do pai não conte a gaveta fechada como um filho e abra
 * 24px de buraco onde deviam ser 12px.
 */
export function CalendarioGaveta({
  meses,
  eventosPorMes,
  eventDayISO,
  todayISO,
  teams,
  canRequest,
  podeCriar,
  teamsComPosicoes,
  templates,
  autoOpenNovo,
  dataInicialNovo,
  children,
  acoes,
}: {
  /** ["2026-07", …, "2026-12"] em ordem — a janela buscada no servidor. */
  meses: string[];
  /** "YYYY-MM" -> eventos daquele mês, já filtrados pela visão da pessoa. */
  eventosPorMes: Record<string, EventListItem[]>;
  /** evento.id -> "YYYY-MM-DD" no fuso da IGREJA (calculado no servidor). */
  eventDayISO: Record<string, string>;
  todayISO: string;
  teams: TeamOption[];
  /** Líder pode "pedir evento nesse dia" dentro do modal do dia. */
  canRequest: boolean;
  /** Admin pode criar evento — desenha o "+" do cabeçalho e "adicionar evento
   *  nesse dia" dentro do modal do dia. */
  podeCriar: boolean;
  /** Só o admin usa (wizard); vem vazio dos outros papéis. */
  teamsComPosicoes: TeamWithPositions[];
  templates: EventTemplate[];
  /** Deep-link de /escalas/novo (?novo=1). */
  autoOpenNovo?: boolean;
  dataInicialNovo?: string;
  /** O botão de criar/sugerir evento, ao lado do botão da gaveta. */
  children?: React.ReactNode;
  /** A ação da direita da linha (hoje, "Balanço do mês"). */
  acoes?: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const [i, setI] = useState(() => Math.max(0, meses.indexOf(todayISO.slice(0, 7))));
  const [novo, setNovo] = useState<string | null>(null);
  const router = useRouter();
  const abriu = useRef(false);

  useEffect(() => {
    // `podeCriar` também aqui: a prop da página é a que um dia alguém esquece, e
    // um wizard sem equipe nem modelo é um beco com sheet por cima.
    if (!autoOpenNovo || !podeCriar || abriu.current) return;
    abriu.current = true;
    setNovo(dataInicialNovo ?? "");
    router.replace("/escalas");
  }, [autoOpenNovo, podeCriar, dataInicialNovo, router]);

  const mes = meses[i] ?? meses[0];
  const y = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  // timeZone UTC de propósito: a string já é "YYYY-MM", não tem hora pra
  // escorregar de fuso — é o mesmo cálculo que o /inicio faz.
  const rotulo = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAberta((v) => !v)}
            aria-expanded={aberta}
            aria-controls="gaveta-calendario"
            aria-label={aberta ? "Fechar o calendário do mês" : "Abrir o calendário do mês"}
            className={cn(
              "press-sm inline-flex size-9 items-center justify-center rounded-full border transition-colors",
              aberta
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <CalendarDays className="size-[18px]" />
          </button>
          {podeCriar ? (
            <button
              type="button"
              onClick={() => setNovo("")}
              aria-label="Criar evento"
              aria-expanded={novo !== null}
              className="press-sm inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Plus className="size-[18px]" />
            </button>
          ) : null}
          {children}
        </div>
        {acoes}
      </div>

      {/*
        A GAVETA. `grid-rows-[0fr] -> [1fr]` é o único jeito de animar uma altura
        desconhecida sem medir nada em JS. Duas coisas são obrigatórias, não
        estéticas:
         · o filho precisa de `min-h-0` — sem isso ele se recusa a encolher
           abaixo do próprio conteúdo e a gaveta simplesmente não fecha;
         · o filho precisa de `overflow-hidden` — sem isso a grade vaza por cima
           da lista durante os 300ms da animação.
        `inert` tira o conteúdo fechado do tab order E da árvore de
        acessibilidade: sem ele, o Tab cairia dentro de uma grade invisível.
        React 19 trata `inert` como booleano de verdade.
        O `transition-duration` é zerado pelo `prefers-reduced-motion` global
        (globals.css:210-217): a gaveta abre no talo, sem animação, pra quem pediu.
      */}
      <div
        id="gaveta-calendario"
        inert={!aberta}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.32,.72,.24,1)]",
          aberta ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">
            <div className="mb-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                disabled={i === 0}
                aria-label="Mês anterior"
                className="press-sm inline-flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="size-5" />
              </button>
              {/* Degrau "title" do DESIGN.md (17px, serifa): é nome próprio de um
                  período, não texto corrido. */}
              <h3 className="flex-1 text-center font-display text-[17px] font-extrabold capitalize">
                {rotulo}
              </h3>
              <button
                type="button"
                onClick={() => setI((n) => Math.min(meses.length - 1, n + 1))}
                disabled={i === meses.length - 1}
                aria-label="Próximo mês"
                className="press-sm inline-flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            {/* Reuso puro: o toque no dia já abre o modal com os eventos daquele
                dia (team-calendar.tsx:62-114). Nada de calendário novo. */}
            <TeamCalendar
              year={y}
              month={m}
              events={eventosPorMes[mes] ?? []}
              eventDayISO={eventDayISO}
              todayISO={todayISO}
              teams={teams}
              canRequest={canRequest}
              onCriarNoDia={podeCriar ? (iso) => setNovo(iso) : undefined}
              hint={
                podeCriar
                  ? "Toque num dia pra ver a escala ou criar um evento."
                  : canRequest
                    ? "Toque num dia pra ver a escala ou pedir um evento."
                    : "Toque num dia pra ver a escala."
              }
            />
          </div>
        </div>
      </div>

      <NovoEventoWizard
        open={novo !== null}
        onClose={() => setNovo(null)}
        teams={teamsComPosicoes}
        templates={templates}
        initialDate={novo || undefined}
      />
    </div>
  );
}
