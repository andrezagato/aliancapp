"use client";

import { useState } from "react";
import type { UnlockedBadge } from "@/lib/achievements";

const SPARKS = ["🎉", "✨", "⭐", "🎊", "💛", "🔥", "🙌"];
// Posições fixas (sem random → sem mismatch de hidratação).
const SPOTS = [
  [8, 12], [88, 18], [20, 78], [78, 82], [50, 8], [12, 45], [90, 55],
  [35, 90], [65, 92], [5, 70], [95, 35], [45, 60],
];

/**
 * Comemoração em tela cheia quando o voluntário desbloqueia conquista(s) — o
 * "momento" divertido que faltava (antes só ia pro sininho). Toca pra avançar.
 */
export function AchievementCelebration({ badges, onDone }: { badges: UnlockedBadge[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  if (badges.length === 0) return null;
  const b = badges[i];
  const advance = () => (i + 1 < badges.length ? setI(i + 1) : onDone());

  return (
    <div
      role="dialog"
      aria-modal
      onClick={advance}
      className="fixed inset-0 z-[120] flex animate-fade-in items-center justify-center bg-black/60 p-6"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SPOTS.map(([left, top], k) => (
          <span
            key={k}
            className="absolute animate-pop text-2xl"
            style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${(k % 6) * 110}ms` }}
          >
            {SPARKS[k % SPARKS.length]}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-xs animate-pop rounded-[26px] bg-card p-7 text-center shadow-lift">
        <div className="relative mx-auto grid size-24 place-items-center">
          <div
            className="absolute inset-0 animate-glow rounded-full"
            style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5), transparent 68%)" }}
            aria-hidden
          />
          <span className="relative text-6xl leading-none">{b.emoji}</span>
        </div>
        <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
          Conquista desbloqueada!
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-foreground">{b.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
          className="press mt-5 h-12 w-full rounded-[15px] bg-primary text-[15.5px] font-extrabold text-primary-foreground"
        >
          {i + 1 < badges.length ? `Próxima (${i + 1}/${badges.length})` : "Boa! 🎉"}
        </button>
      </div>
    </div>
  );
}
