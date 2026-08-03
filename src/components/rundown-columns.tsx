"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { warm } from "@/lib/toasts";
import {
  iniciarCronograma,
  reiniciarCronograma,
  encerrarCronograma,
  marcarBlocoFeito,
} from "@/lib/actions";
import type { RundownItem, RundownKind } from "@/lib/data";
import type { ActionResult } from "@/lib/types";
import {
  useRundownTiming,
  fmtHora,
  clock,
  heatOf,
  HEAT_TEXT,
  type RundownRow,
} from "@/components/rundown-timing";
import { useRundownRealtime } from "@/components/rundown-realtime";

/**
 * O ROTEIRO EM GRADE — o desenho da régia (bloco = linha, campo = coluna).
 *
 * Por que existe em vez de um `layout="colunas"` no grid do celular: as duas
 * telas respondem a perguntas diferentes. No celular, com 380px, a pergunta é
 * "o que eu faço agora" e a resposta é UM bloco grande por vez, empilhado. Na
 * régia, num monitor 16:9, a pergunta é "onde estamos e vamos furar o horário?",
 * e aí o que importa é ver o culto INTEIRO de relance, com hora de relógio em
 * cada linha. Compartilham o cálculo (`useRundownTiming`) e a sincronia
 * (`useRundownRealtime`); divergem no desenho, de propósito.
 *
 * Escolhas de coluna, contra o que Ontime/Cuer fazem:
 *  - SEM coluna de link: 0 dos 28 blocos reais da Aliança usa o campo. Coluna
 *    que nasce vazia parece defeito.
 *  - SEM coluna de tipo: hoje `kind` é a MESMA palavra do título ("Louvor" /
 *    "Louvor"). O tipo já fala pela COR da linha.
 *  - Observação leva a folga: é o único campo com texto de verdade (44
 *    caracteres em média), enquanto os títulos têm 8.
 *
 * A régia CONDUZ, o celular EDITA. Aqui dá pra iniciar, avançar e encerrar —
 * o que se faz com o culto rolando. Reordenar, criar e apagar bloco continua na
 * aba Roteiro: no meio do culto ninguém reestrutura, e um arraste acidental num
 * monitor de sala de controle sairia caro.
 */

const COLS = "grid-cols-[2.5rem_4.5rem_4.5rem_4rem_minmax(7rem,1fr)_minmax(6rem,1fr)_minmax(10rem,2.2fr)]";

function Cabecalho() {
  return (
    <div
      className={cn(
        "grid items-center gap-x-3 border-b border-border px-3 pb-1.5",
        "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        COLS,
      )}
    >
      <span className="text-center">#</span>
      <span>Início</span>
      <span>Fim</span>
      <span>Dur.</span>
      <span>Bloco</span>
      <span>Responsável</span>
      <span>Observação</span>
    </div>
  );
}

/** "Atrasado 7 min" / "Adiantado 3 min" / "No horário". */
function desvioTexto(ms: number): { texto: string; tom: string } {
  const min = Math.round(ms / 60000);
  if (min === 0) return { texto: "No horário", tom: "text-success-ink" };
  if (min > 0) return { texto: `Atrasado ${min} min`, tom: "text-destructive-ink" };
  return { texto: `Adiantado ${Math.abs(min)} min`, tom: "text-success-ink" };
}

function Linha({
  row,
  idx,
  cor,
  now,
  podeAvancar,
  onAvancar,
  ocupado,
}: {
  row: RundownRow;
  idx: number;
  cor: string;
  now: number | null;
  podeAvancar: boolean;
  onAvancar: () => void;
  ocupado: boolean;
}) {
  const { it, startMs, endMs, durMs, status } = row;
  const live = status === "live";
  const done = status === "done";
  // Marca de "estou editando" vale por 2 min (igual ao celular): esquecida por
  // quem fechou o app, ela não pode assombrar o bloco durante o culto.
  const editandoNome =
    it.editingBy && it.editingAt && now != null && now - new Date(it.editingAt).getTime() < 120_000
      ? (it.editingNome ?? "Alguém")
      : null;
  const decorridoMs = live ? (now != null ? now - startMs : 0) : done ? endMs - startMs : durMs;
  const estourouMs = Math.max(0, decorridoMs - durMs);
  const heat = live ? heatOf(durMs - decorridoMs) : done && estourouMs > 0 ? "red" : "normal";

  return (
    <div
      className={cn(
        "grid items-center gap-x-3 border-l-4 px-3 py-2 text-[13.5px]",
        COLS,
        live && "bg-primary/[0.07] font-semibold",
        done && "text-muted-foreground",
      )}
      style={{ borderLeftColor: cor }}
      aria-current={live ? "step" : undefined}
    >
      {/* número, ou o ponto pulsando de "é aqui que estamos" */}
      <span className="text-center tabular-nums">
        {live ? (
          <span className="inline-flex items-center gap-1">
            <span className="size-2 animate-pulse rounded-full bg-destructive-ink" />
            <span className="sr-only">Ao vivo:</span>
          </span>
        ) : (
          <span className={cn(done && "line-through")}>{idx + 1}</span>
        )}
      </span>

      <span className="tabular-nums">{fmtHora(startMs)}</span>
      <span className={cn("tabular-nums", live && "text-muted-foreground")}>{fmtHora(endMs)}</span>

      {/* duração planejada; ao vivo, o cronômetro ocupa o lugar e ganha a cor */}
      <span className={cn("tabular-nums", live && HEAT_TEXT[heat])}>
        {live ? clock(Math.max(0, decorridoMs)) : `${it.durationMin}m`}
      </span>

      <span className="min-w-0 truncate" title={it.title}>
        {it.title}
        {done && estourouMs > 0 ? (
          <span className="ml-1.5 text-[11px] font-semibold text-destructive-ink">
            +{clock(estourouMs)}
          </span>
        ) : null}
      </span>

      <span className="min-w-0 truncate text-muted-foreground" title={it.responsible ?? ""}>
        {it.responsible || "—"}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate" title={it.note ?? ""}>
          {it.note || <span className="text-muted-foreground">—</span>}
        </span>
        {/* Alguém está com o bloco na mão (trava macia da 0048). Chega pelo
            realtime, então a régia vê em ~1s — e sabe que a observação pode mudar
            debaixo dos olhos dela. */}
        {editandoNome ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-ink">
            {editandoNome} editando
          </span>
        ) : null}
        {podeAvancar && live ? (
          <button
            onClick={onAvancar}
            disabled={ocupado}
            className="press-sm ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-[12.5px] font-bold text-primary-foreground disabled:opacity-60"
          >
            <Check className="size-3.5" /> Encerrar bloco
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function RundownColumns({
  eventId,
  startsAt,
  startedAt,
  endedAt,
  items,
  kinds,
  canEdit,
}: {
  eventId: string;
  startsAt: string;
  startedAt: string | null;
  endedAt: string | null;
  items: RundownItem[];
  kinds: RundownKind[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [ocupado, startTx] = useTransition();

  // Só-leitura no que importa pro realtime: não há estado local espelhando
  // `items` aqui (sem arraste, sem modal), então nunca precisa esperar a mão.
  useRundownRealtime({ eventId });

  const { now, rows, totalMin, allDone, startedMs, endedMs, finishMs, desvioMs, corDoBloco } =
    useRundownTiming({ items, kinds, startsAt, started: startedAt, ended: endedAt });

  const rodando = startedMs != null && endedMs == null;
  const desvio = desvioTexto(desvioMs);

  const agir = (fn: () => Promise<ActionResult>, sucesso?: string) =>
    startTx(async () => {
      const r = await fn();
      if (!r.ok) {
        showToast(r.error);
        return;
      }
      if (sucesso) showToast(sucesso);
      router.refresh();
    });

  if (items.length === 0) {
    return (
      <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">
        Este culto ainda não tem roteiro. Monte a ordem na aba Roteiro.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 min-w-[52rem] flex-col">
      {/* ---- faixa de estado: a pergunta da régia é "vamos furar o horário?" */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-3">
        <span className="text-[13px] text-muted-foreground">
          Término previsto{" "}
          <strong className="tabular-nums text-foreground">{fmtHora(finishMs)}</strong>
        </span>
        {rodando ? <span className={cn("text-[13px] font-bold", desvio.tom)}>{desvio.texto}</span> : null}
        <span className="text-[13px] text-muted-foreground">
          {items.length} blocos · {totalMin} min planejados
        </span>

        {canEdit ? (
          <span className="ml-auto flex items-center gap-1.5">
            {!rodando && !allDone && startedMs == null ? (
              <button
                onClick={() => agir(() => iniciarCronograma(eventId))}
                disabled={ocupado}
                className="press-sm inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
              >
                <Play className="size-4" /> Iniciar
              </button>
            ) : null}
            {rodando ? (
              <button
                onClick={() => agir(() => encerrarCronograma(eventId), warm("cultoEncerrado"))}
                disabled={ocupado}
                aria-label="Encerrar o roteiro"
                title="Encerrar o roteiro"
                className="press-sm inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-bold disabled:opacity-60"
              >
                <Square className="size-3.5" /> Encerrar
              </button>
            ) : null}
            {startedMs != null ? (
              <button
                onClick={() => {
                  if (!window.confirm("Reiniciar o roteiro deste culto? Os blocos voltam a ficar em aberto.")) return;
                  agir(() => reiniciarCronograma(eventId));
                }}
                disabled={ocupado}
                aria-label="Reiniciar o roteiro"
                title="Reiniciar o roteiro"
                className="press-sm grid size-9 place-items-center rounded-full border border-border disabled:opacity-60"
              >
                <RotateCcw className="size-4" />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>

      <Cabecalho />

      <div className="min-h-0 divide-y divide-border">
        {rows.map((row, idx) => (
          <Linha
            key={row.it.id}
            row={row}
            idx={idx}
            cor={corDoBloco(row.it)}
            now={now}
            podeAvancar={canEdit && rodando}
            ocupado={ocupado}
            onAvancar={() => agir(() => marcarBlocoFeito(row.it.id, eventId, true))}
          />
        ))}
      </div>
    </div>
  );
}
