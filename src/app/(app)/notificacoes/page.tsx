import Link from "next/link";
import { Bell, Check, CircleDashed, Sparkles, CalendarClock, UserCheck, Cake } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NotificationKind } from "@/lib/supabase/database.types";

function iconFor(kind: NotificationKind): { Icon: typeof Bell; tone: string } {
  switch (kind) {
    case "confirmado":
    case "cadastro_aprovado":
      return { Icon: Check, tone: "text-success bg-success/12" };
    case "vaga_aberta":
    case "cobertura":
      return { Icon: CircleDashed, tone: "text-primary bg-primary/10" };
    case "interesse_servir":
      return { Icon: Sparkles, tone: "text-accent bg-accent/12" };
    case "evento_alterado":
    case "lembrete":
    case "evento_confirmar":
      return { Icon: CalendarClock, tone: "text-warning bg-warning/12" };
    case "escalado":
    case "cadastro_pendente":
      return { Icon: UserCheck, tone: "text-primary bg-primary/10" };
    case "aniversario":
      return { Icon: Cake, tone: "text-accent bg-accent/12" };
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

  return (
    <>
      <TopBar title="Notificações" subtitle="Só o que é das suas equipes" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-2 py-4">
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
              const inner = (
                <div className="flex items-center gap-3 p-4">
                  <span className={`inline-flex size-10 items-center justify-center rounded-full ${tone}`}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${n.read_at ? "font-normal" : "font-medium"}`}>{n.title}</p>
                    {n.body ? <p className="truncate text-sm text-muted-foreground">{n.body}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
                </div>
              );
              return (
                <Card key={n.id} className={n.read_at ? "opacity-70" : undefined}>
                  {n.link ? <Link href={n.link}>{inner}</Link> : inner}
                </Card>
              );
            })}
            <p className="flex items-center justify-center gap-2 pt-4 text-center text-xs text-muted-foreground">
              <Bell className="size-3.5" /> Avisos compartimentados por equipe
            </p>
          </>
        )}
      </div>
    </>
  );
}
