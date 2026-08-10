"use client";

import { useEffect, useState } from "react";
import type { RundownItem, RundownKind } from "@/lib/data";
import { CATEGORY_NEUTRAL } from "@/lib/palette";

/**
 * O CORAÇÃO DO ROTEIRO AO VIVO — projeção de horários, num lugar só.
 *
 * Existe porque agora há DOIS desenhos do mesmo roteiro: a lista vertical do
 * celular (`rundown-grid.tsx`) e a grade em colunas da régia
 * (`rundown-columns.tsx`). O cálculo é idêntico e delicado — a hora de cada
 * bloco depende do que o anterior REALMENTE levou — então duplicá-lo seria
 * garantir que um dia as duas telas discordassem sobre que hora começa o sermão.
 *
 * A regra que faz isso valer ao vivo: o cursor cascateia com o tempo REAL. Bloco
 * encerrado empurra os seguintes pelo seu `done_at` (não pela duração planejada),
 * e o bloco ao vivo estica além do previsto enquanto ninguém o encerra. É daí que
 * sai, de graça, o "atrasado/adiantado" do culto inteiro.
 */

export const RUNDOWN_DEFAULT_COLOR = CATEGORY_NEUTRAL;

const tf = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** Hora do relógio (HH:MM) no fuso da igreja. */
export const fmtHora = (ms: number) => tf.format(new Date(ms));

const pad = (n: number) => String(n).padStart(2, "0");
/** Cronômetro: `4:32`, e `1:02:34` quando passa de uma hora. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/**
 * Contagem REGRESSIVA do bloco ao vivo: `4:32` e `−1:23` depois de estourar.
 *
 * O bloco conta pra baixo; o culto continua contando pra cima. É a convenção de
 * todo software de régia (ProPresenter, Ontime, Stage Timer, e os sistemas de
 * rundown de TV), e aqui ela corrigia três desencontros nossos: a cor já era
 * calculada pelo tempo que FALTA (ver `heatOf` logo abaixo) enquanto o número
 * mostrava o que já tinha passado; a ponte manda `clockType: 0` — regressiva —
 * pro monitor do palco, então o pregador lia "faltam 4:32" e a régia lia "20:28
 * corridos" do MESMO bloco; e eram dois números ("corrido" + "passou") onde um
 * só resolve.
 *
 * Sinal de menos de verdade (U+2212), não hífen: ele tem a largura de dígito das
 * `tabular-nums` e não faz o cronômetro pular de largura ao cruzar o zero.
 */
export function contagemRegressiva(ms: number): string {
  return (ms < 0 ? "−" : "") + clock(Math.abs(ms));
}

/** Escala de cor do contador conforme o tempo restante do bloco (ao vivo). */
export type Heat = "normal" | "amber" | "orange" | "red";
export function heatOf(remainingMs: number): Heat {
  if (remainingMs <= 0) return "red";
  if (remainingMs <= 60_000) return "orange";
  if (remainingMs <= 120_000) return "amber";
  return "normal";
}
// O sistema tem DUAS cores de alerta (âmbar = atenção, telha = estourou), não
// três. O terceiro degrau escala no PESO, não numa cor nova de biblioteca.
export const HEAT_TEXT: Record<Heat, string> = {
  normal: "text-foreground",
  amber: "text-warning-ink",
  orange: "text-destructive-ink",
  red: "text-destructive-ink font-extrabold",
};

export type RundownStatus = "done" | "live" | "future" | "planned";

export type RundownRow = {
  it: RundownItem;
  startMs: number;
  endMs: number;
  durMs: number;
  status: RundownStatus;
};

export type RundownTiming = {
  /** `null` no primeiro render (evita divergência de hidratação). */
  now: number | null;
  rows: RundownRow[];
  liveIdx: number;
  totalMin: number;
  allDone: boolean;
  startedMs: number | null;
  endedMs: number | null;
  plannedStartMs: number;
  plannedFinishMs: number;
  /** Fim projetado com o que já aconteceu de verdade. */
  finishMs: number;
  /** Congela em `endedMs` quando o culto foi encerrado; senão segue o relógio. */
  liveNow: number | null;
  /** Vai passar da hora (com 1 min de tolerância). */
  overFinish: boolean;
  /** Desvio do culto: > 0 atrasado, < 0 adiantado, em ms. */
  desvioMs: number;
  corDoBloco: (it: RundownItem) => string;
};

export function useRundownTiming({
  items,
  kinds,
  startsAt,
  started,
  ended,
}: {
  items: RundownItem[];
  kinds: RundownKind[];
  startsAt: string;
  started: string | null;
  ended: string | null;
}): RundownTiming {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startedMs = started ? new Date(started).getTime() : null;
  const endedMs = ended ? new Date(ended).getTime() : null;
  const plannedStartMs = new Date(startsAt).getTime();
  const liveNow = endedMs ?? now;
  const liveIdx = startedMs != null && endedMs == null ? items.findIndex((it) => !it.doneAt) : -1;
  const totalMin = items.reduce((s, i) => s + i.durationMin, 0);
  const allDone = items.length > 0 && items.every((it) => it.doneAt);

  let cursor = startedMs ?? plannedStartMs;
  const rows: RundownRow[] = items.map((it, i) => {
    const durMs = it.durationMin * 60000;
    const startMs = cursor;
    let endMs: number;
    let status: RundownStatus;
    if (it.doneAt) {
      endMs = new Date(it.doneAt).getTime();
      status = "done";
    } else if (i === liveIdx) {
      status = "live";
      const plannedEnd = startMs + durMs;
      endMs = liveNow != null ? Math.max(plannedEnd, liveNow) : plannedEnd;
    } else {
      status = startedMs != null ? "future" : "planned";
      endMs = startMs + durMs;
    }
    cursor = endMs;
    return { it, startMs, endMs, durMs, status };
  });

  const finishMs = cursor;
  const plannedFinishMs = plannedStartMs + totalMin * 60000;
  const overFinish = startedMs != null && endedMs == null && finishMs > plannedFinishMs + 60000;
  // Antes de começar, `finishMs` é igual ao planejado e o desvio é zero sozinho —
  // não precisa de caso especial.
  const desvioMs = finishMs - plannedFinishMs;

  const corDoBloco = (it: RundownItem) =>
    it.color ?? kinds.find((k) => k.label === it.kind)?.color ?? RUNDOWN_DEFAULT_COLOR;

  return {
    now,
    rows,
    liveIdx,
    totalMin,
    allDone,
    startedMs,
    endedMs,
    plannedStartMs,
    plannedFinishMs,
    finishMs,
    liveNow,
    overFinish,
    desvioMs,
    corDoBloco,
  };
}
