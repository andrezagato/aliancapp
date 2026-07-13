import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

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
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur pt-safe">
      <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/notificacoes"
            aria-label="Notificações"
            className="relative inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </Link>
          <Link href="/perfil" aria-label="Perfil">
            <Avatar name={userName} className="size-9" />
          </Link>
        </div>
      </div>
    </header>
  );
}
