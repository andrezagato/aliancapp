"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/**
 * Cabeçalho reativo (variante sticky, para as abas internas). Entre 0–70px de
 * scroll o título grande encolhe/some e um título condensado central faz
 * fade-in, com o fundo blur ganhando opacidade — mesmo comportamento do
 * ReactiveHeader da home, mas em fluxo (sticky), sem precisar de espaçador.
 */
export function TopBar({
  title,
  subtitle,
  userName,
  unread = 0,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  unread?: number;
}) {
  const bg = useRef<HTMLDivElement>(null);
  const condensed = useRef<HTMLDivElement>(null);
  const big = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const t = Math.min(1, Math.max(0, window.scrollY) / 70);
      // O título grande some DE VEZ (opacidade 0 em t=0.5) antes do condensado
      // entrar (a partir de t=0.55) — sem os dois títulos sobrepostos.
      if (bg.current) bg.current.style.opacity = String(t);
      if (condensed.current) condensed.current.style.opacity = String(Math.max(0, (t - 0.55) / 0.45));
      if (big.current) {
        big.current.style.transform = `scale(${1 - 0.12 * t}) translateY(${-6 * t}px)`;
        big.current.style.opacity = String(Math.max(0, 1 - t / 0.5));
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-30 -mx-5 pt-safe">
      <div
        ref={bg}
        aria-hidden
        className="absolute inset-0 border-b border-border/90 bg-background/85 opacity-0 backdrop-blur-lg"
      />
      <div
        ref={condensed}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.9rem)] text-center font-display text-[17px] font-bold text-foreground opacity-0"
      >
        {title}
      </div>
      <div className="relative mx-auto flex max-w-[520px] items-center gap-3 px-5 pb-3.5 pt-2">
        <div ref={big} className="min-w-0 flex-1 origin-top-left">
          <div className="truncate font-display text-[26px] font-extrabold leading-[1.04] tracking-tight text-foreground">
            {title}
          </div>
          {subtitle ? <div className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        <Link
          href="/notificacoes"
          aria-label="Notificações"
          className="press relative grid size-[42px] shrink-0 place-items-center rounded-full bg-primary/[0.06] text-foreground"
        >
          <Bell className="size-[21px]" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 grid min-w-[17px] place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Link>
        <Link href="/perfil" aria-label="Perfil" className="press-sm shrink-0">
          <Avatar name={userName} className="size-[42px] border border-border/90 text-[15px] font-extrabold" />
        </Link>
      </div>
    </header>
  );
}
