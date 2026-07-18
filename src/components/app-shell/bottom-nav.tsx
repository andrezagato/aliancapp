"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, ClipboardList, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EffectiveRole } from "@/lib/auth";

const base = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/escalas", label: "Escalas", icon: CalendarDays },
];

export function BottomNav({ role }: { role: EffectiveRole }) {
  const pathname = usePathname();

  // Cronograma (Planning Center) pra todos; Equipes pra quem gerencia (admin/líder).
  const items = [
    ...base,
    { href: "/cronograma", label: "Cronograma", icon: ClipboardList },
    ...(role !== "volunteer" ? [{ href: "/equipes", label: "Equipes", icon: Users }] : []),
    { href: "/perfil", label: "Perfil", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/85 backdrop-blur-lg pb-safe">
      <div className="mx-auto flex max-w-[520px] items-stretch justify-around px-2 pt-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press-sm flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-semibold",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                  active ? "bg-accent/40 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.3]")} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
