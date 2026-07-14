"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pull-to-refresh: puxar no topo (window.scrollY <= 0) revela a "chama" que
 * gira conforme a distância; soltar > ~48px dispara `router.refresh()`. Ignora
 * gestos que começam num card com swipe ([data-swipe]) — quem manda ali é o
 * arrasto horizontal do próprio card.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [h, setH] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const flame = useRef<HTMLSpanElement>(null);

  const onDown = (e: React.PointerEvent) => {
    if (refreshing) return;
    const onCard = (e.target as Element)?.closest?.("[data-swipe]");
    if (window.scrollY <= 0 && !onCard) start.current = e.clientY;
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current == null) return;
    const d = e.clientY - start.current;
    if (d > 0 && window.scrollY <= 0) {
      const hh = Math.min(90, d * 0.5);
      setH(hh);
      if (flame.current) flame.current.style.transform = `rotate(${hh * 4}deg)`;
    } else if (d < 0) {
      setH(0);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (start.current == null) return;
    const d = (e.clientY - start.current) * 0.5;
    start.current = null;
    if (d > 48) {
      setRefreshing(true);
      setH(46);
      router.refresh();
      window.setTimeout(() => {
        setRefreshing(false);
        setH(0);
      }, 900);
    } else {
      setH(0);
    }
  };

  return (
    <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div
        style={{ height: h, opacity: Math.min(1, h / 50) }}
        className="flex items-end justify-center overflow-hidden transition-[height,opacity] duration-200"
      >
        <div className="flex items-center gap-2 pb-2 text-[12.5px] font-bold text-primary">
          <span ref={flame} className={cn("grid place-items-center", refreshing && "animate-flame")}>
            <Flame className="size-[18px]" strokeWidth={2.2} />
          </span>
          <span>{refreshing ? "Atualizando…" : h > 48 ? "Solte para atualizar" : "Puxe para atualizar"}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
