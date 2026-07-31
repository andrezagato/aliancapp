"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BADGE_BY_CODE, type UnlockedBadge } from "@/lib/achievements";

const SPARKS = ["🎉", "✨", "⭐", "🎊", "💛", "🔥", "🙌"];

/** Comemoração em tela cheia ao desbloquear conquista(s). Toque avança. */
export function AchievementCelebration({ badges, onDone }: { badges: UnlockedBadge[]; onDone: () => void }) {
  const [i, setI] = useState(0);

  // confete em leque — direções/rotações determinísticas (sem random → sem mismatch)
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, k) => {
        const ang = (k / 16) * Math.PI * 2 + (k % 2 ? 0.3 : -0.25);
        const dist = 150 + (k % 3) * 46;
        return {
          e: SPARKS[k % SPARKS.length],
          to: `translate(${Math.round(Math.cos(ang) * dist)}px, ${Math.round(Math.sin(ang) * dist - 40)}px)`,
          rot: `${(k % 2 ? 1 : -1) * (140 + (k % 4) * 40)}deg`,
          delay: (k % 6) * 55,
          size: 18 + (k % 3) * 8,
        };
      }),
    [],
  );

  if (badges.length === 0) return null;
  const b = badges[i];
  const cta = BADGE_BY_CODE[b.code]?.cta ?? null;
  const advance = () => (i + 1 < badges.length ? setI(i + 1) : onDone());

  return (
    <div
      role="dialog"
      aria-modal
      onClick={advance}
      className="fixed inset-0 z-[120] flex animate-fade-in items-center justify-center bg-black/60 p-6"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p, k) => (
          <span
            key={k}
            className="confetti-pc"
            style={{ ["--to" as string]: p.to, ["--rot" as string]: p.rot, animationDelay: `${p.delay}ms`, fontSize: p.size }}
          >
            {p.e}
          </span>
        ))}
      </div>

      <div className="anim-spring relative w-full max-w-xs rounded-[26px] bg-card p-7 text-center shadow-lift">
        <div className="relative mx-auto grid size-24 place-items-center">
          <div
            className="absolute inset-0 animate-glow rounded-full"
            style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5), transparent 68%)" }}
            aria-hidden
          />
          <span className="anim-emoji relative text-6xl leading-none">{b.emoji}</span>
        </div>
        <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
          Conquista desbloqueada!
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-foreground">{b.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
        {cta ? (
          // A comemoração é o único instante em que a pessoa está 100% olhando pro
          // app — se existe um próximo passo óbvio (o perfil vazio), o convite
          // mora aqui, não num card que ela vai dispensar depois.
          <Link
            href={cta.href}
            onClick={(e) => {
              e.stopPropagation();
              onDone();
            }}
            className="press mt-5 flex h-12 w-full items-center justify-center rounded-[15px] bg-primary text-[15px] font-extrabold text-primary-foreground"
          >
            {cta.label}
          </Link>
        ) : null}
        <button
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
          className={
            cta
              ? "press-sm mt-2 h-11 w-full rounded-[15px] text-[15px] font-semibold text-muted-foreground"
              : "press mt-5 h-12 w-full rounded-[15px] bg-primary text-[15px] font-extrabold text-primary-foreground"
          }
        >
          {i + 1 < badges.length ? `Próxima (${i + 1}/${badges.length})` : cta ? "Depois" : "Boa! 🎉"}
        </button>
      </div>
    </div>
  );
}
