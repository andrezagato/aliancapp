import { Bell, Check, CircleDashed, Sparkles } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { demoUser } from "@/lib/demo";

const demoNotifs = [
  {
    icon: Check,
    tone: "text-success bg-success/12",
    title: "Juliana confirmou",
    body: "Vocal · Culto de Domingo",
    when: "há 2h",
  },
  {
    icon: CircleDashed,
    tone: "text-primary bg-primary/10",
    title: "Vaga em aberto: Bateria",
    body: "Culto de Domingo — ninguém escalado ainda",
    when: "há 5h",
  },
  {
    icon: Sparkles,
    tone: "text-accent bg-accent/12",
    title: "Novo interesse em servir",
    body: "Juliana quer aprender Teclado",
    when: "ontem",
  },
];

export default function NotificacoesPage() {
  return (
    <>
      <TopBar
        title="Notificações"
        subtitle="Só o que é das suas equipes"
        userName={demoUser.fullName}
      />
      <div className="animate-fade-in space-y-2 py-4">
        {demoNotifs.map((n, i) => {
          const Icon = n.icon;
          return (
            <Card key={i}>
              <div className="flex items-center gap-3 p-4">
                <span className={`inline-flex size-10 items-center justify-center rounded-full ${n.tone}`}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{n.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{n.when}</span>
              </div>
            </Card>
          );
        })}
        <p className="flex items-center justify-center gap-2 pt-4 text-center text-xs text-muted-foreground">
          <Bell className="size-3.5" /> Avisos compartimentados por equipe
        </p>
      </div>
    </>
  );
}
