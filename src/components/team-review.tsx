"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, ClipboardCheck } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { carregarRevisaoEvento, salvarAvaliacaoCulto, salvarObservacaoPessoa } from "@/lib/actions";
import { fmtEventWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventReviewData, PendingTeamReview } from "@/lib/data";

/**
 * Avaliação da equipe (líder/admin): nota 1-5 do culto + uma observação por
 * pessoa que serviu. Privado à liderança. Botão + bottom-sheet que carrega os
 * dados sob demanda. Usado no Finalizados do Roteiro e no card da home.
 */
export function TeamReview({
  eventId,
  trigger,
  triggerClassName,
}: {
  eventId: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EventReviewData | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [, startTx] = useTransition();

  const abrir = async () => {
    setOpen(true);
    setLoading(true);
    const d = await carregarRevisaoEvento(eventId);
    setData(d);
    setRating(d?.myRating ?? 0);
    setNotes(Object.fromEntries((d?.people ?? []).map((p) => [p.profileId, p.note])));
    setLoading(false);
  };

  const fechar = () => {
    setOpen(false);
    router.refresh(); // atualiza o "pendente" da home / Finalizados
  };

  const escolherNota = (n: number) => {
    setRating(n);
    startTx(async () => {
      const r = await salvarAvaliacaoCulto(eventId, n);
      if (!r.ok) showToast(r.error);
    });
  };

  const salvarNota = (subjectId: string, original: string) => {
    const val = notes[subjectId] ?? "";
    if (val.trim() === original.trim()) return; // nada mudou
    startTx(async () => {
      const r = await salvarObservacaoPessoa(eventId, subjectId, val);
      if (!r.ok) showToast(r.error);
    });
  };

  return (
    <>
      <button type="button" onClick={abrir} className={triggerClassName}>
        {trigger}
      </button>

      <Modal open={open} onClose={fechar} sheet title="Avaliar a equipe">
        {loading ? (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : data ? (
          <div className="mt-1">
            <p className="text-sm font-semibold text-foreground">{data.title}</p>
            <p className="text-[13px] capitalize text-muted-foreground">{fmtEventWhen(data.startsAt)}</p>

            {/* Nota do culto */}
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-sm font-semibold">Como foi o culto no geral?</p>
              <div className="mt-2 flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => escolherNota(n)} aria-label={`${n} estrelas`} className="press-sm p-1">
                    <Star
                      className={cn("size-8", n <= rating ? "fill-accent text-accent" : "text-muted-foreground/40")}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Observação por pessoa */}
            <p className="mb-2 mt-5 px-1 text-sm font-semibold">Observações por pessoa</p>
            {data.people.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Ninguém confirmado nesse culto pra observar.
              </p>
            ) : (
              <div className="space-y-3 pb-1">
                {data.people.map((p) => (
                  <div key={p.profileId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
                      <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                      {p.teamName ? <span className="shrink-0 text-[11px] text-muted-foreground">{p.teamName}</span> : null}
                    </div>
                    <textarea
                      value={notes[p.profileId] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [p.profileId]: e.target.value }))}
                      onBlur={() => salvarNota(p.profileId, p.note)}
                      rows={2}
                      placeholder="Como foi? (opcional — só a liderança vê)"
                      className="w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-center text-[12px] text-muted-foreground">Salvo automaticamente. 💛</p>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Não deu pra carregar essa avaliação.</p>
        )}
      </Modal>
    </>
  );
}

/** Card na home do líder: cultos encerrados que faltam avaliar. */
export function TeamReviewPrompt({ pending }: { pending: PendingTeamReview[] }) {
  if (pending.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Avaliar a equipe</h3>
      <div className="space-y-2">
        {pending.map((p) => (
          <TeamReview
            key={p.eventId}
            eventId={p.eventId}
            triggerClassName="press flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/15 p-4 text-left"
            trigger={
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <ClipboardCheck className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">Avalie: {p.title}</span>
                  <span className="block truncate text-[13px] capitalize text-muted-foreground">
                    {fmtEventWhen(p.startsAt)} · toque pra avaliar
                  </span>
                </span>
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}
