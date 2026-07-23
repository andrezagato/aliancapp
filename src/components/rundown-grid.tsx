"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  Play,
  RotateCcw,
  Flag,
  ExternalLink,
  Settings2,
  LayoutTemplate,
  X,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  adicionarBlocoCronograma,
  atualizarBlocoCronograma,
  removerBlocoCronograma,
  reordenarCronograma,
  ajustarDuracaoBloco,
  iniciarCronograma,
  reiniciarCronograma,
  encerrarCronograma,
  marcarBlocoFeito,
  adicionarTipoBloco,
  removerTipoBloco,
  salvarModeloCronograma,
  excluirModeloCronograma,
  aplicarModeloCronograma,
  contribuirNoBloco,
} from "@/lib/actions";
import { warm } from "@/lib/toasts";
import type { RundownItem, RundownKind, RundownTemplate } from "@/lib/data";

const PX_PER_MIN = 6; // altura do bloco = duração × isto (arrastar 1min = 6px)
const MIN_H = 72; // altura mínima pra caber os contadores/toque
const DEFAULT_COLOR = "#6b7280";
const SWATCHES = [
  "#0e7490",
  "#7c3aed",
  "#2563eb",
  "#b45309",
  "#be185d",
  "#9d174d",
  "#0891b2",
  "#15803d",
  "#db2777",
  "#ea580c",
  "#4f46e5",
  "#6b7280",
];

const tf = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fmt = (ms: number) => tf.format(new Date(ms));
const heightOf = (dur: number) => Math.max(MIN_H, dur * PX_PER_MIN);
const pad = (n: number) => String(n).padStart(2, "0");
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Escala de cor do contador conforme o tempo restante do bloco (ao vivo).
type Heat = "normal" | "amber" | "orange" | "red";
function heatOf(remainingMs: number): Heat {
  if (remainingMs <= 0) return "red";
  if (remainingMs <= 60_000) return "orange";
  if (remainingMs <= 120_000) return "amber";
  return "normal";
}
const HEAT_TEXT: Record<Heat, string> = {
  normal: "text-foreground",
  amber: "text-amber-500",
  orange: "text-orange-500",
  red: "text-red-600",
};

/** Contador com rótulo (início · corrido · passou). */
function Stat({
  label,
  value,
  className,
  big,
  strike,
}: {
  label: string;
  value: string;
  className?: string;
  big?: boolean;
  strike?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "font-bold tabular-nums leading-none",
          big ? "text-[22px]" : "text-[15px]",
          strike && "line-through",
          className,
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

type Row = {
  it: RundownItem;
  startMs: number;
  endMs: number;
  durMs: number;
  status: "done" | "live" | "future" | "planned";
};

type Drag =
  | { mode: "resize"; id: string; startY: number; startDur: number; newDur: number }
  | { mode: "reorder"; id: string }
  | null;

export function RundownGrid({
  eventId,
  startsAt,
  startedAt,
  endedAt,
  items,
  kinds,
  templates,
  canEdit,
  canContribute,
}: {
  eventId: string;
  startsAt: string;
  startedAt: string | null;
  endedAt: string | null;
  items: RundownItem[];
  kinds: RundownKind[];
  templates: RundownTemplate[];
  canEdit: boolean;
  canContribute: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTx] = useTransition();

  const [list, setList] = useState(items);
  const [started, setStarted] = useState<string | null>(startedAt);
  const [ended, setEnded] = useState<string | null>(endedAt);
  const [drag, setDrag] = useState<Drag>(null);
  const [now, setNow] = useState<number | null>(null);
  const [editing, setEditing] = useState<RundownItem | "new" | null>(null);
  const [contributing, setContributing] = useState<RundownItem | null>(null);
  const [manageKinds, setManageKinds] = useState(false);
  const [manageTpl, setManageTpl] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null); // bloco recém-movido (destaque pós-drop)

  useEffect(() => setList(items), [items]);
  useEffect(() => setStarted(startedAt), [startedAt]);
  useEffect(() => setEnded(endedAt), [endedAt]);

  // Relógio ao vivo (só depois de montar, pra não quebrar a hidratação).
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const listRef = useRef(list);
  listRef.current = list;
  const dragRef = useRef<Drag>(null);
  dragRef.current = drag;
  const itemRefs = useRef(new Map<string, HTMLElement>());

  const colorOf = useCallback(
    (it: RundownItem) => it.color ?? kinds.find((k) => k.label === it.kind)?.color ?? DEFAULT_COLOR,
    [kinds],
  );

  // ---- Projeção de horários (o coração do "ao vivo") ----------------------
  const startedMs = started ? new Date(started).getTime() : null;
  const endedMs = ended ? new Date(ended).getTime() : null;
  const plannedStartMs = new Date(startsAt).getTime();
  // Encerrado → congela em endedMs (nada "ao vivo"); senão segue o relógio.
  const liveNow = endedMs ?? now;
  const liveIdx = startedMs != null && endedMs == null ? list.findIndex((it) => !it.doneAt) : -1;
  const totalMin = list.reduce((s, i) => s + i.durationMin, 0);
  const allDone = list.length > 0 && list.every((it) => it.doneAt);

  let cursor = startedMs ?? plannedStartMs;
  const rows: Row[] = list.map((it, i) => {
    const durMs = it.durationMin * 60000;
    const startMs = cursor;
    let endMs: number;
    let status: Row["status"];
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
  const overFinish = startedMs != null && endedMs == null && finishMs > plannedStartMs + totalMin * 60000 + 60000;

  // ---- Persistência -------------------------------------------------------
  const persistOrder = (next: RundownItem[]) =>
    startTx(async () => {
      await reordenarCronograma(eventId, next.map((x) => x.id));
      router.refresh();
    });
  const persistDuration = (id: string, dur: number) =>
    startTx(async () => {
      await ajustarDuracaoBloco(id, eventId, dur);
      router.refresh();
    });

  // ---- Gestos (arrastar) --------------------------------------------------
  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "resize") {
      const deltaMin = Math.round((e.clientY - d.startY) / PX_PER_MIN);
      const newDur = Math.max(1, d.startDur + deltaMin);
      setDrag({ ...d, newDur });
      setList((prev) => prev.map((it) => (it.id === d.id ? { ...it, durationMin: newDur } : it)));
    } else {
      const ids = listRef.current.map((x) => x.id);
      let over = ids.length - 1;
      for (let i = 0; i < ids.length; i++) {
        const el = itemRefs.current.get(ids[i]);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          over = i;
          break;
        }
      }
      const cur = listRef.current;
      const from = cur.findIndex((x) => x.id === d.id);
      if (from !== -1 && over !== from) {
        const next = [...cur];
        const [moved] = next.splice(from, 1);
        next.splice(over, 0, moved);
        setList(next);
      }
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    window.removeEventListener("pointermove", onPointerMove);
    setDrag(null);
    if (!d) return;
    if (d.mode === "resize") {
      const it = listRef.current.find((x) => x.id === d.id);
      if (it) persistDuration(it.id, it.durationMin);
    } else {
      persistOrder(listRef.current);
      setFlashId(d.id);
      window.setTimeout(() => setFlashId(null), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMove]);

  const beginResize = (e: React.PointerEvent, it: RundownItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ mode: "resize", id: it.id, startY: e.clientY, startDur: it.durationMin, newDur: it.durationMin });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };
  const beginReorder = (e: React.PointerEvent, it: RundownItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ mode: "reorder", id: it.id });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const toggleDone = (it: RundownItem) => {
    const done = !it.doneAt;
    setList((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, doneAt: done ? new Date().toISOString() : null } : x)),
    );
    startTx(async () => {
      await marcarBlocoFeito(it.id, eventId, done);
      router.refresh();
    });
  };

  const start = () => {
    setStarted(new Date().toISOString());
    startTx(async () => {
      const r = await iniciarCronograma(eventId);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });
  };
  const reset = () => {
    setStarted(null);
    setEnded(null);
    setList((prev) => prev.map((x) => ({ ...x, doneAt: null })));
    startTx(async () => {
      await reiniciarCronograma(eventId);
      router.refresh();
    });
  };
  const encerrar = () => {
    setEnded(new Date().toISOString());
    startTx(async () => {
      const r = await encerrarCronograma(eventId);
      if (r.ok) {
        showToast(warm("cultoEncerrado"));
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  };
  const remove = (id: string) =>
    startTx(async () => {
      const r = await removerBlocoCronograma(id, eventId);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  return (
    <section>
      {/* Cabeçalho: início → fim + total + relógio ao vivo */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div>
          <h3 className="font-display text-lg font-bold leading-tight">Ordem do culto</h3>
          {list.length > 0 ? (
            <p className="text-[13px] font-semibold tabular-nums text-muted-foreground">
              {fmt(startedMs ?? plannedStartMs)} → <span className={cn(overFinish && "text-warning")}>{fmt(finishMs)}</span>
              <span className="font-normal"> · {totalMin} min</span>
            </p>
          ) : null}
        </div>
        {list.length > 0 ? (
          started ? (
            <div className="flex items-center gap-1.5">
              <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", ended ? "bg-success/12" : "bg-destructive/10")}>
                {ended ? null : <span className="size-2 animate-pulse rounded-full bg-destructive" />}
                <span className={cn("text-[11px] font-extrabold uppercase tracking-wide", ended ? "text-success" : "text-destructive")}>
                  {ended ? "Encerrado" : "Ao vivo"}
                </span>
                <span className={cn("text-xl font-extrabold tabular-nums leading-none", ended ? "text-success" : "text-destructive")}>
                  {clock((liveNow ?? startedMs ?? 0) - (startedMs ?? 0))}
                </span>
              </div>
              {canEdit && !ended ? (
                <button
                  onClick={() => window.confirm("Encerrar o culto agora? O relógio para.") && encerrar()}
                  className="press-sm inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[12px] font-bold text-destructive"
                >
                  <Flag className="size-3.5" /> Encerrar
                </button>
              ) : null}
              {canEdit ? (
                <button
                  onClick={() => window.confirm("Reiniciar o cronograma? Isso apaga o início, o encerramento e os checks.") && reset()}
                  aria-label="Reiniciar"
                  className="press-sm grid size-9 place-items-center rounded-full border border-border text-muted-foreground"
                >
                  <RotateCcw className="size-4" />
                </button>
              ) : null}
            </div>
          ) : canEdit ? (
            <button
              onClick={() => window.confirm("Iniciar o culto agora? O relógio começa a rodar.") && start()}
              className="press inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-extrabold text-primary-foreground"
            >
              <Play className="size-4 fill-current" /> Iniciar culto
            </button>
          ) : null
        ) : null}
      </div>

      {canEdit && started && !ended && allDone ? (
        <button
          onClick={() => window.confirm("Encerrar o culto? Todos os blocos foram concluídos.") && encerrar()}
          className="press mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-3 text-sm font-extrabold text-white"
        >
          <Check className="size-4" strokeWidth={3} /> Tudo concluído — encerrar culto
        </button>
      ) : null}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {canEdit ? "Monte a ordem do culto adicionando blocos abaixo." : "A ordem do culto ainda não foi montada."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map(({ it, startMs, endMs, status }, idx) => {
            const color = colorOf(it);
            const done = status === "done";
            const live = status === "live";
            const last = idx === rows.length - 1;
            const resizingThis = drag?.mode === "resize" && drag.id === it.id;
            const reorderingThis = drag?.mode === "reorder" && drag.id === it.id;
            const durMs = it.durationMin * 60000;
            const elapsedMs = live ? (now != null ? now - startMs : 0) : done ? endMs - startMs : durMs;
            const overMs = Math.max(0, elapsedMs - durMs);
            const h: Heat = live ? heatOf(durMs - elapsedMs) : done && overMs > 0 ? "red" : "normal";
            const liveRed = live && h === "red";
            return (
              <li
                key={it.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(it.id, el);
                  else itemRefs.current.delete(it.id);
                }}
                className="flex select-none items-stretch"
              >
                {/* Régua: horário de início */}
                <div className="flex w-[46px] shrink-0 flex-col items-end pr-1 pt-2.5 text-right">
                  <span
                    className={cn(
                      "text-[13px] font-bold leading-none tabular-nums",
                      done ? "text-muted-foreground line-through" : liveRed ? "text-red-600" : live ? "text-primary" : "text-foreground",
                    )}
                  >
                    {fmt(startMs)}
                  </span>
                  {live ? <span className="mt-1 text-[9px] font-extrabold uppercase tracking-wide text-primary">agora</span> : null}
                </div>

                {/* Trilha do tempo (linha + nó) */}
                <div className="relative w-4 shrink-0" aria-hidden>
                  <span className={cn("absolute left-1/2 top-0 w-px -translate-x-1/2 bg-border", last ? "bottom-2.5" : "-bottom-2")} />
                  <span
                    className="absolute left-1/2 top-2.5 size-2.5 -translate-x-1/2 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: liveRed ? "#ef4444" : color }}
                  />
                </div>

                {/* Card */}
                <div
                  style={{ minHeight: heightOf(it.durationMin) }}
                  onClick={() => (canEdit ? !drag && setEditing(it) : canContribute && setContributing(it))}
                  className={cn(
                    "relative flex min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border bg-card transition-[box-shadow,transform,opacity,background-color]",
                    (canEdit || canContribute) && "cursor-pointer",
                    done && "opacity-55",
                    live && !liveRed && "border-primary shadow-[0_0_0_2px_hsl(var(--primary))]",
                    liveRed && "border-red-500 bg-red-600/5 shadow-[0_0_0_2px_#ef4444]",
                    !live && "border-border",
                    reorderingThis && "z-30 scale-[1.04] rotate-1 opacity-95 shadow-2xl ring-2 ring-primary",
                    flashId === it.id && "animate-pop ring-2 ring-primary",
                  )}
                >
                  {resizingThis ? (
                    <span className="absolute right-2 top-2 z-20 rounded-full bg-foreground px-2.5 py-1 text-sm font-extrabold tabular-nums text-background shadow-lift">
                      {it.durationMin} min
                    </span>
                  ) : null}
                  {/* Tick de "feito" */}
                  {canEdit ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDone(it);
                      }}
                      aria-label={done ? "Desmarcar feito" : "Marcar feito"}
                      className={cn(
                        "my-3 ml-3 grid size-7 shrink-0 place-items-center self-start rounded-full border-2 transition-colors",
                        done ? "border-success bg-success text-white" : live ? "border-primary text-primary" : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-4" strokeWidth={3.5} />
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "my-3 ml-3 grid size-7 shrink-0 place-items-center self-start rounded-full",
                        done ? "bg-success text-white" : live ? "border-2 border-primary" : "border-2 border-border",
                      )}
                    >
                      {done ? <Check className="size-4" strokeWidth={3.5} /> : null}
                    </span>
                  )}

                  {/* Contadores + textos */}
                  <div className="my-2.5 ml-3 min-w-0 flex-1 pr-1">
                    {live || done ? (
                      <div className="flex items-end gap-5">
                        <Stat
                          label="corrido"
                          value={clock(elapsedMs)}
                          big={live}
                          className={live ? HEAT_TEXT[h] : "text-muted-foreground"}
                        />
                        {overMs > 0 ? (
                          <Stat label="passou" value={`+${clock(overMs)}`} big={live} className="text-red-600" />
                        ) : null}
                      </div>
                    ) : (
                      <Stat label="duração" value={`${it.durationMin} min`} className="text-muted-foreground" />
                    )}
                    <p className={cn("mt-1.5 font-semibold leading-tight", done && "line-through")}>{it.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {it.kind}
                      {it.responsible ? ` · ${it.responsible}` : ""}
                    </p>
                    {it.note ? <p className="mt-0.5 text-[13px] text-muted-foreground">{it.note}</p> : null}
                    {it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                      >
                        <ExternalLink className="size-3.5" /> Abrir link
                      </a>
                    ) : null}
                    {canContribute && !canEdit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContributing(it);
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                      >
                        <Plus className="size-3.5" /> {it.link || it.note ? "Editar link/info" : "Adicionar link/info"}
                      </button>
                    ) : null}
                  </div>

                  {/* Alça de reordenar */}
                  {canEdit ? (
                    <button
                      onPointerDown={(e) => beginReorder(e, it)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Arrastar pra reordenar"
                      style={{ touchAction: "none" }}
                      className="my-2 mr-1 grid w-8 shrink-0 cursor-grab place-items-center self-center rounded-lg text-muted-foreground/60 hover:bg-muted active:cursor-grabbing"
                    >
                      <GripVertical className="size-5" />
                    </button>
                  ) : null}

                  {/* Alça de redimensionar (borda de baixo) */}
                  {canEdit ? (
                    <div
                      onPointerDown={(e) => beginResize(e, it)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ touchAction: "none" }}
                      className="absolute inset-x-0 bottom-0 flex h-4 cursor-ns-resize items-center justify-center"
                      aria-label="Arrastar pra mudar a duração"
                    >
                      <span className={cn("h-1 w-10 rounded-full", resizingThis ? "bg-primary" : "bg-border")} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canEdit ? (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setEditing("new")}
            className="press flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 py-3 text-sm font-bold text-primary"
          >
            <Plus className="size-4" /> Adicionar bloco
          </button>
          <button
            onClick={() => setManageTpl(true)}
            aria-label="Modelos de cronograma"
            className="press grid w-12 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <LayoutTemplate className="size-5" />
          </button>
          <button
            onClick={() => setManageKinds(true)}
            aria-label="Gerenciar tipos"
            className="press grid w-12 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <Settings2 className="size-5" />
          </button>
        </div>
      ) : null}

      {editing ? (
        <BlocoModal
          eventId={eventId}
          item={editing === "new" ? null : editing}
          kinds={kinds}
          onManageKinds={() => setManageKinds(true)}
          onDelete={editing !== "new" ? () => remove((editing as RundownItem).id) : undefined}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {contributing ? <ContribuirModal item={contributing} onClose={() => setContributing(null)} /> : null}

      {manageKinds ? <KindsManager kinds={kinds} onClose={() => setManageKinds(false)} /> : null}

      {manageTpl ? (
        <TemplatesManager
          eventId={eventId}
          templates={templates}
          currentItems={list.map((it) => ({
            kind: it.kind,
            title: it.title,
            color: it.color,
            durationMin: it.durationMin,
            note: it.note,
          }))}
          onClose={() => setManageTpl(false)}
        />
      ) : null}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Modal do bloco — tipo primeiro, nome já preenchido
// -----------------------------------------------------------------------------
const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

// -----------------------------------------------------------------------------
// Modal de CONTRIBUIÇÃO — voluntário escalado só adiciona link/observação
// -----------------------------------------------------------------------------
function ContribuirModal({ item, onClose }: { item: RundownItem; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [link, setLink] = useState(item.link ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTx(async () => {
      const r = await contribuirNoBloco(item.id, link, note);
      if (r.ok) {
        onClose();
        router.refresh();
        showToast(warm("blocoSalvo"));
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title={item.title}>
      <div className="mt-1 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Link (opcional)</span>
          <input className={inputCls} placeholder="YouTube, Drive, letra…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Observação (opcional)</span>
          <textarea rows={2} className={cn(inputCls, "resize-none")} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          onClick={save}
          disabled={pending}
          className="press h-[52px] w-full rounded-[15px] bg-primary text-[15.5px] font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function BlocoModal({
  eventId,
  item,
  kinds,
  onManageKinds,
  onDelete,
  onClose,
}: {
  eventId: string;
  item: RundownItem | null;
  kinds: RundownKind[];
  onManageKinds: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [kind, setKind] = useState(item?.kind ?? "");
  const [color, setColor] = useState(item?.color ?? null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [duration, setDuration] = useState(String(item?.durationMin ?? 5));
  const [responsible, setResponsible] = useState(item?.responsible ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [error, setError] = useState<string | null>(null);

  const pickKind = (k: RundownKind) => {
    setKind(k.label);
    setColor(k.color);
    // Preenche o nome com o tipo se ainda estiver vazio ou igual ao tipo anterior.
    if (!title.trim() || title.trim() === kind.trim()) setTitle(k.label);
  };

  const save = () => {
    setError(null);
    startTx(async () => {
      const input = {
        title: title.trim() || kind,
        kind: kind || "Outro",
        color: color ?? undefined,
        durationMin: Number(duration) || 0,
        responsible,
        note,
        link,
      };
      const r = item
        ? await atualizarBlocoCronograma(item.id, eventId, input)
        : await adicionarBlocoCronograma(eventId, input);
      if (r.ok) {
        onClose();
        router.refresh();
        showToast(warm("blocoSalvo"));
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title={item ? "Editar bloco" : "Novo bloco"}>
      <div className="mt-1 space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-medium">Tipo</p>
            <button onClick={onManageKinds} className="press-sm inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
              <Settings2 className="size-3.5" /> Gerenciar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => pickKind(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
                  kind === k.label ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: k.color }} /> {k.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome do bloco</span>
          <input
            className={inputCls}
            placeholder="Ex.: Louvor de entrada"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium">Duração (min)</span>
            <input type="number" inputMode="numeric" min={1} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className="flex-[2]">
            <span className="mb-1 block text-sm font-medium">Quem faz (opcional)</span>
            <input className={inputCls} placeholder="Ex.: Banda / Pr. João" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Observação (opcional)</span>
          <textarea rows={2} className={cn(inputCls, "resize-none")} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Link (opcional)</span>
          <input className={inputCls} placeholder="YouTube, Drive, letra…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          onClick={save}
          disabled={pending || (!title.trim() && !kind)}
          className={cn(
            "press h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold",
            title.trim() || kind ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {pending ? "Salvando…" : item ? "Salvar" : "Adicionar"}
        </button>
        {onDelete ? (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            disabled={pending}
            className="press-sm inline-flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-destructive"
          >
            <Trash2 className="size-4" /> Remover bloco
          </button>
        ) : null}
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Gerenciar tipos (por igreja)
// -----------------------------------------------------------------------------
function KindsManager({ kinds, onClose }: { kinds: RundownKind[]; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  const add = () =>
    startTx(async () => {
      const r = await adicionarTipoBloco(label, color);
      if (r.ok) {
        setLabel("");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  const del = (id: string) =>
    startTx(async () => {
      const r = await removerTipoBloco(id);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title="Tipos de bloco">
      <div className="mt-1 space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Os tipos são da igreja toda. Remover um tipo não altera blocos já criados.
        </p>
        <ul className="flex flex-col gap-1.5">
          {kinds.map((k) => (
            <li key={k.id} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2">
              <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: k.color }} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{k.label}</span>
              <button
                onClick={() => del(k.id)}
                disabled={pending}
                aria-label={`Remover ${k.label}`}
                className="press-sm grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Novo tipo</p>
          <input
            className={inputCls}
            placeholder="Nome do tipo (ex.: Batismo)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                style={{ backgroundColor: c }}
                className={cn("size-7 rounded-full", color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "")}
              />
            ))}
          </div>
          <button
            onClick={add}
            disabled={pending || label.trim().length < 1}
            className="press h-11 w-full rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Adicionando…" : "Adicionar tipo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Modelos de cronograma (presets de blocos)
// -----------------------------------------------------------------------------
type TplItem = { kind: string; title: string; color: string | null; durationMin: number; note: string | null };

function TemplatesManager({
  eventId,
  templates,
  currentItems,
  onClose,
}: {
  eventId: string;
  templates: RundownTemplate[];
  currentItems: TplItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [name, setName] = useState("");

  const apply = (id: string) =>
    startTx(async () => {
      const r = await aplicarModeloCronograma(eventId, id);
      if (r.ok) {
        showToast("Modelo aplicado — é só ajustar 🙌");
        onClose();
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  const save = () =>
    startTx(async () => {
      const r = await salvarModeloCronograma(name, currentItems);
      if (r.ok) {
        showToast("Modelo salvo ✨");
        setName("");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  const del = (id: string) =>
    startTx(async () => {
      const r = await excluirModeloCronograma(id);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title="Modelos de cronograma">
      <div className="mt-1 space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Usar um modelo</p>
          {templates.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nenhum modelo ainda. Monte um cronograma e salve como modelo abaixo pra reaproveitar.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
                  <button
                    onClick={() => apply(t.id)}
                    disabled={pending}
                    className="press-sm min-w-0 flex-1 text-left disabled:opacity-60"
                  >
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {t.items.length} bloco{t.items.length === 1 ? "" : "s"} ·{" "}
                      {t.items.reduce((s, i) => s + (i.durationMin || 0), 0)} min
                    </p>
                  </button>
                  <button
                    onClick={() => del(t.id)}
                    disabled={pending}
                    aria-label={`Excluir ${t.name}`}
                    className="press-sm grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Salvar o cronograma atual como modelo</p>
          <input
            className={inputCls}
            placeholder="Nome (ex.: Culto de Domingo)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={save}
            disabled={pending || name.trim().length < 1 || currentItems.length === 0}
            className="press h-11 w-full rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar como modelo"}
          </button>
          {currentItems.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Adicione blocos primeiro pra poder salvar.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
