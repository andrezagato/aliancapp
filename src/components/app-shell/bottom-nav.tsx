"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, ClipboardList, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const base = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/escalas", label: "Escalas", icon: CalendarDays },
];

export function BottomNav() {
  const pathname = usePathname();

  // Equipes pra todos: admin/líder gerenciam; voluntário vê quem serve com ele.
  const items = [
    ...base,
    { href: "/cronograma", label: "Cronograma", icon: ClipboardList },
    { href: "/equipes", label: "Equipes", icon: Users },
    { href: "/perfil", label: "Perfil", icon: User },
  ];

  const activeIdx = Math.max(
    0,
    items.findIndex((it) => pathname === it.href || pathname.startsWith(it.href + "/")),
  );
  const w = 100 / items.length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/85 backdrop-blur-lg pb-safe">
      <div className="relative mx-auto flex max-w-[520px] items-stretch pt-1.5 lg:max-w-[720px]">
        {/* pílula deslizante — wrapper ocupa exatamente 1 célula (w%) e centraliza a barra */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 flex justify-center transition-[left] duration-300 ease-[cubic-bezier(.32,.72,.24,1)]"
          style={{ width: `${w}%`, left: `${activeIdx * w}%` }}
        >
          <span className="h-8 w-14 rounded-full bg-accent/40" />
        </span>
        {items.map(({ href, label, icon: Icon }, idx) => {
          const active = idx === activeIdx;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press-sm relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex h-8 w-14 items-center justify-center">
                <Icon
                  key={active ? "on" : "off"}
                  className={cn("size-5 transition-transform", active && "stroke-[2.3] nav-pop")}
                />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
