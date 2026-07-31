import Link from "next/link";
import { Bell, Check, CircleDashed, Sparkles, CalendarClock, UserCheck, Cake, ChevronLeft } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MarkAllRead } from "@/components/mark-all-read";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NotificationKind } from "@/lib/supabase/database.types";

function iconFor(kind: NotificationKind): { Icon: typeof Bell; tone: string } {
  switch (kind) {
    case "confirmado":
    case "cadastro_aprovado":
      return { Icon: Check, tone: "text-success-ink bg-success/12" };
    case "vaga_aberta":
    case "cobertura":
      return { Icon: CircleDashed, tone: "text-primary bg-primary/10" };
    case "interesse_servir":
      return { Icon: Sparkles, tone: "text-accent bg-accent/15" };
    case "evento_alterado":
    case "lembrete":
    case "evento_confirmar":
      return { Icon: CalendarClock, tone: "text-warning-ink bg-warning/12" };
    case "escalado":
    case "cadastro_pendente":
      return { Icon: UserCheck, tone: "text-primary bg-primary/10" };
    case "aniversario":
      return { Icon: Cake, tone: "text-accent bg-accent/15" };
    default:
      return { Icon: Bell, tone: "text-muted-foreground bg-muted" };
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d}d`;
  return `há ${Math.round(d / 7)}sem`;
}

export default async function NotificacoesPage() {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const notifs = data ?? [];
  const hasUnread = notifs.some((n) => !n.read_at);

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-30 -mx-4 border-b border-border/70 bg-background/90 pt-safe backdrop-blur">
        <div className="flex items-center gap-1 px-5 pb-3 pt-2">
          <Link
            href="/inicio"
            className="press -ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[15px] font-bold text-primary"
          >
            <ChevronLeft className="size-5" /> Voltar
          </Link>
          <span className="font-display text-[17px] font-bold text-foreground">Notificações</span>
        </div>
      </header>

      <div className="space-y-2.5 py-4">
        {hasUnread ? <MarkAllRead /> : null}
        {notifs.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-7" />}
            title="Tudo em dia"
            description="Avisos de escala, confirmações e interesses aparecem aqui — sempre compartimentados por equipe."
          />
        ) : (
          <>
            {notifs.map((n) => {
              const { Icon, tone } = iconFor(n.kind);
              const unread = !n.read_at;
              const inner = (
                <div className="flex items-start gap-3 p-3.5">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-[11px]", tone)}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", unread ? "font-semibold text-foreground" : "text-foreground/80")}>
                      {n.title}
                    </p>
                    {n.body ? <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground/80">{relativeTime(n.created_at)}</p>
                  </div>
                  {unread ? <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" aria-label="Não lida" /> : null}
                </div>
              );
              const shell = cn(
                "block rounded-2xl border",
                unread ? "border-accent/40 bg-card shadow-soft" : "border-border/70 bg-background/50",
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className={cn(shell, "press-sm")}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className={shell}>
                  {inner}
                </div>
              );
            })}
            <p className="flex items-center justify-center gap-2 pt-3 text-center text-xs text-muted-foreground">
              <Bell className="size-3.5" /> Avisos compartimentados por equipe
            </p>
          </>
        )}
      </div>
    </div>
  );
}
