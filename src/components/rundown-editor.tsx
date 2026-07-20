"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  adicionarBlocoCronograma,
  atualizarBlocoCronograma,
  removerBlocoCronograma,
  reordenarCronograma,
} from "@/lib/actions";
import type { RundownItem } from "@/lib/data";

const KINDS: { v: string; label: string; color: string }[] = [
  { v: "louvor", label: "Louvor", color: "#7c3aed" },
  { v: "palavra", label: "Palavra", color: "#b45309" },
  { v: "aviso", label: "Avisos", color: "#0e7490" },
  { v: "oracao", label: "Oração", color: "#2563eb" },
  { v: "video", label: "Vídeo", color: "#db2777" },
  { v: "transicao", label: "Transição", color: "#6b7280" },
  { v: "outro", label: "Outro", color: "#4b5563" },
];
const kindMeta = (v: string) => KINDS.find((k) => k.v === v) ?? KINDS[KINDS.length - 1];

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

function hhmm(baseIso: string, addMin: number): string {
  const t = new Date(new Date(baseIso).getTime() + addMin * 60000);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(t);
}

export function RundownEditor({
  eventId,
  startsAt,
  items,
  canEdit,
}: {
  eventId: string;
  startsAt: string;
  items: RundownItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, start] = useTransition();
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);
  const [editing, setEditing] = useState<RundownItem | "new" | null>(null);

  const total = list.reduce((s, i) => s + i.durationMin, 0);
  let acc = 0;
  const withTimes = list.map((it) => {
    const startAt = acc;
    acc += it.durationMin;
    return { it, startAt };
  });

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    start(async () => {
      await reordenarCronograma(
        eventId,
        next.map((x) => x.id),
      );
      router.refresh();
    });
  };

  const remove = (id: string) =>
    start(async () => {
      const r = await removerBlocoCronograma(id, eventId);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className="font-display text-lg font-bold">Ordem do culto</h3>
        {total > 0 ? <span className="text-xs font-semibold text-muted-foreground tabular-nums">{total} min no total</span> : null}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {canEdit ? "Monte a ordem do culto adicionando blocos abaixo." : "A ordem do culto ainda não foi montada."}
        </p>
      ) : (
        <ol className="space-y-2">
          {withTimes.map(({ it, startAt }, idx) => {
            const meta = kindMeta(it.kind);
            return (
              <li key={it.id} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex w-11 shrink-0 flex-col items-center">
                    <span className="text-sm font-bold tabular-nums text-foreground">{hhmm(startsAt, startAt)}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{it.durationMin}min</span>
                  </div>
                  <span className="mt-1 h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{it.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {meta.label}
                      {it.responsible ? ` · ${it.responsible}` : ""}
                    </p>
                    {it.note ? <p className="mt-0.5 text-[13px] text-muted-foreground">{it.note}</p> : null}
                    {it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                      >
                        <ExternalLink className="size-3.5" /> Abrir link
                      </a>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 flex-col items-center">
                      <button
                        onClick={() => move(idx, -1)}
                        disabled={pending || idx === 0}
                        aria-label="Subir"
                        className="press-sm rounded-md p-1 text-muted-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        onClick={() => move(idx, 1)}
                        disabled={pending || idx === list.length - 1}
                        aria-label="Descer"
                        className="press-sm rounded-md p-1 text-muted-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="mt-2 flex justify-end gap-1 border-t border-border/60 pt-2">
                    <button
                      onClick={() => setEditing(it)}
                      className="press-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="size-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => remove(it.id)}
                      disabled={pending}
                      className="press-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" /> Remover
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {canEdit ? (
        <button
          onClick={() => setEditing("new")}
          className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 py-3 text-sm font-bold text-primary"
        >
          <Plus className="size-4" /> Adicionar bloco
        </button>
      ) : null}

      {editing ? (
        <BlocoModal eventId={eventId} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </section>
  );
}

function BlocoModal({ eventId, item, onClose }: { eventId: string; item: RundownItem | null; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(item?.title ?? "");
  const [kind, setKind] = useState(item?.kind ?? "louvor");
  const [duration, setDuration] = useState(String(item?.durationMin ?? 5));
  const [responsible, setResponsible] = useState(item?.responsible ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    start(async () => {
      const input = { title, kind, durationMin: Number(duration) || 0, responsible, note, link };
      const r = item
        ? await atualizarBlocoCronograma(item.id, eventId, input)
        : await adicionarBlocoCronograma(eventId, input);
      if (r.ok) {
        onClose();
        router.refresh();
        showToast(item ? "Bloco atualizado." : "Bloco adicionado.");
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title={item ? "Editar bloco" : "Novo bloco"}>
      <div className="mt-1 space-y-3">
        <input
          className={inputCls}
          placeholder="Título (ex.: Momento de louvor)"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.v}
                type="button"
                onClick={() => setKind(k.v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold",
                  kind === k.v ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium">Duração (min)</span>
            <input type="number" inputMode="numeric" min={0} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
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
          disabled={pending || title.trim().length < 1}
          className={cn(
            "press h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold",
            title.trim() ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {pending ? "Salvando…" : item ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </Modal>
  );
}
