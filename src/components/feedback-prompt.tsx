"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { AchievementCelebration } from "@/components/achievement-celebration";
import { enviarFeedback } from "@/lib/actions";
import { markSeen } from "@/lib/achievements-seen";
import { fmtEventWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PendingFeedback } from "@/lib/data";
import type { UnlockedBadge } from "@/lib/achievements";

/**
 * "Feedback do culto": ao fim de cada culto servido, a pessoa dá de 1 a 5
 * estrelas + um recado — PRIVADO (só ela vê). Dar feedback também rende
 * conquista. Aparece na home do voluntário enquanto houver cultos por avaliar.
 */
export function FeedbackPrompt({ pending }: { pending: PendingFeedback[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState<PendingFeedback | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, start] = useTransition();
  const [celebrate, setCelebrate] = useState<UnlockedBadge[]>([]);

  if (pending.length === 0) return null;

  const openFor = (p: PendingFeedback) => {
    setOpen(p);
    setRating(0);
    setComment("");
  };

  const submit = () => {
    if (!open || rating < 1) return;
    const ev = open;
    start(async () => {
      const r = await enviarFeedback(ev.eventId, rating, comment);
      if (r.ok) {
        setOpen(null);
        showToast("Feedback enviado — obrigado! 💛");
        if (r.unlocked && r.unlocked.length > 0) {
          markSeen(r.unlocked.map((b) => b.code));
          setCelebrate(r.unlocked);
        }
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  };

  return (
    <>
      <section>
        <h3 className="mb-2 px-1 text-base font-semibold">Feedback do culto</h3>
        <div className="space-y-2">
          {pending.map((p) => (
            <button
              key={p.eventId}
              type="button"
              onClick={() => openFor(p)}
              className="press flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-accent/20 p-4 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/25 text-xl">⭐</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">Como foi {p.title}?</p>
                <p className="truncate text-[13px] capitalize text-muted-foreground">
                  {fmtEventWhen(p.startsAt)} · toque pra avaliar
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <Modal open={!!open} onClose={() => !busy && setOpen(null)} sheet title="Feedback do culto">
        {open ? (
          <div className="mt-1">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Como foi servir em <span className="font-semibold text-foreground">{open.title}</span>? Isso é só pra
              você. 💛
            </p>
            <div className="mt-4 flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} estrelas`} className="press-sm p-1">
                  <Star
                    className={cn("size-9", n <= rating ? "fill-accent text-accent" : "text-muted-foreground/40")}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Quer registrar algo sobre esse culto? (opcional)"
              className="mt-4 w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={submit}
              disabled={busy || rating < 1}
              className={cn(
                "press mt-4 h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold",
                rating >= 1 ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              {busy ? "Enviando…" : "Enviar feedback"}
            </button>
          </div>
        ) : null}
      </Modal>

      <AchievementCelebration badges={celebrate} onDone={() => setCelebrate([])} />
    </>
  );
}
