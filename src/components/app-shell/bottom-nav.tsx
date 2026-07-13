"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, CalendarX2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EffectiveRole } from "@/lib/auth";

const base = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/escalas", label: "Escalas", icon: CalendarDays },
];

export function BottomNav({ role }: { role: EffectiveRole }) {
  const pathname = usePathname();

  const contextual =
    role === "admin"
      ? { href: "/pessoas", label: "Pessoas", icon: Users }
      : { href: "/disponibilidade", label: "Livre?", icon: CalendarX2 };

  const items = [...base, contextual, { href: "/perfil", label: "Perfil", icon: User }];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-[520px] items-stretch justify-around px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.4]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
