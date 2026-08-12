"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/status";
import type { MyAssignment } from "@/lib/data";
import { fmtWeekdayShort, fmtDayMonthShort, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Linha de escala com swipe: arrastar → revela "Confirmar" (verde); arrastar ←
 * revela "Não posso" (vermelho, abre o sheet). Discrimina swipe × scroll pela
 * dominância do eixo. Cards já resolvidos (não-convidado) limitam o arrasto à
 * direita — só o swipe pra recusar continua valendo. Toque abre o detalhe.
 *
 * Sem moldura própria de propósito (Fase 6 do pós-audit): o pai empilha várias
 * dessas num único papel com `divide-y` ("Depois disso" deixou de ser um card
 * por linha) — cor/borda/sombra são do papel, não da linha.
 */
const THRESHOLD = 88;

export function SwipeCard({
  a,
  onConfirm,
  onCancel,
  onOpen,
}: {
  a: MyAssignment;
  onConfirm: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const gesture = useRef<{ x: number; y: number; mode: null | "swipe" | "scroll" } | null>(null);
  const swiped = useRef(false);

  const canConfirm = a.status === "convidado";
  const meta = STATUS_META[a.status];

  const onDown = (e: React.PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY, mode: null };
    setSettling(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const ddx = e.clientX - g.x;
    const ddy = e.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(ddx) > 9 && Math.abs(ddx) > Math.abs(ddy)) g.mode = "swipe";
      else if (Math.abs(ddy) > 9) g.mode = "scroll";
    }
    if (g.mode === "swipe") {
      const rightMax = canConfirm ? 140 : 42;
      setDx(Math.max(-140, Math.min(rightMax, ddx)));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "swipe") {
      const ddx = e.clientX - g.x;
      swiped.current = true;
      window.setTimeout(() => (swiped.current = false), 60);
      setSettling(true);
      setDx(0);
      if (ddx > THRESHOLD && canConfirm) onConfirm();
      else if (ddx < -THRESHOLD) onCancel();
    }
  };

  const rl = dx > 0 ? Math.min(1, dx / 70) : 0;
  const rr = dx < 0 ? Math.min(1, -dx / 70) : 0;

  return (
    <div data-swipe className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      <div className="absolute inset-0 flex items-center justify-between" aria-hidden>
        <div
          style={{ opacity: rl }}
          className="flex h-full flex-1 items-center gap-2 bg-success pl-6 text-sm font-extrabold text-white"
        >
          <Check className="size-5" strokeWidth={2.6} /> Confirmar
        </div>
        <div
          style={{ opacity: rr }}
          className="flex h-full flex-1 items-center justify-end gap-2 bg-destructive pr-6 text-sm font-extrabold text-white"
        >
          Não posso <X className="size-5" strokeWidth={2.6} />
        </div>
      </div>

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          "relative flex items-center gap-3 bg-card p-3.5",
          settling && "transition-transform duration-300 ease-out",
        )}
      >
        <button
          onClick={() => {
            if (!swiped.current) onOpen();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex w-[50px] shrink-0 flex-col items-center rounded-[13px] bg-muted py-1.5">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
              {fmtWeekdayShort(a.startsAt)}
            </span>
            <span className="font-display text-[21px] font-extrabold leading-none text-primary">
              {fmtDayMonthShort(a.startsAt).split(" ")[0]}
            </span>
            <span className="text-[9.5px] text-muted-foreground">{fmtTime(a.startsAt)}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">{a.eventTitle}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: a.teamColor || "hsl(var(--muted-foreground))" }} />
              {a.teamName} · {a.positionName}
            </span>
          </span>
        </button>
        <Badge variant={meta.variant} className="shrink-0">
          {meta.label}
        </Badge>
      </div>
    </div>
  );
}
