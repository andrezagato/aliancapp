import Link from "next/link";
import {
  MapPin,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  Clock,
  Sparkles,
  Plus,
} from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_META } from "@/lib/status";
import {
  demoUser,
  demoEvent,
  demoEscala,
  demoPendencias,
  demoInteresses,
} from "@/lib/demo";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function InicioPage() {
  const filled = demoEscala.filter((s) => s.person && s.status !== "recusado");
  const confirmed = demoEscala.filter((s) => s.status === "confirmado").length;

  return (
    <>
      <TopBar
        title={`${greeting()}, ${demoUser.name}`}
        subtitle={demoUser.roleLabel}
        userName={demoUser.fullName}
        unread={3}
      />

      <div className="animate-fade-in space-y-5 py-3">
        {/* Próximo culto */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 to-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarDays className="size-4" />
              Próximo culto
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{demoEvent.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {demoEvent.dateLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {demoEvent.location}
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confirmações da sua equipe</span>
                <span className="font-semibold">
                  {confirmed}/{filled.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${(confirmed / Math.max(filled.length, 1)) * 100}%` }}
                />
              </div>
            </div>

            <Link href="/escalas" className={cn(buttonVariants(), "mt-4 w-full")}>
              Ver escala completa
            </Link>
          </CardContent>
        </Card>

        {/* Pendências (visão do líder) */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={<CircleDashed className="size-5" />}
            value={demoPendencias.vagasAbertas}
            label="Vagas abertas"
            tone="primary"
          />
          <StatTile
            icon={<Clock className="size-5" />}
            value={demoPendencias.aguardandoConfirmacao}
            label="Aguardando"
            tone="warning"
          />
          <StatTile
            icon={<Sparkles className="size-5" />}
            value={demoInteresses.length}
            label="Interesses"
            tone="accent"
          />
        </div>

        {/* Escala da equipe */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-base font-semibold">Sua equipe neste culto</h3>
            <span className="text-sm text-muted-foreground">Louvor</span>
          </div>
          <Card>
            <ul className="divide-y divide-border">
              {demoEscala.map((slot) => {
                const meta = STATUS_META[slot.status];
                return (
                  <li key={slot.position} className="flex items-center gap-3 p-4">
                    {slot.person ? (
                      <Avatar name={slot.person} />
                    ) : (
                      <span className="inline-flex size-10 items-center justify-center rounded-full border-2 border-dashed border-primary/40 text-primary">
                        <Plus className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {slot.person ?? "Vaga em aberto"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{slot.position}</p>
                    </div>
                    {slot.person ? (
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    ) : (
                      <Button size="sm" variant="outline">
                        Escalar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        {/* Interesses em servir */}
        {demoInteresses.length > 0 && (
          <section>
            <h3 className="mb-2 px-1 text-base font-semibold">Interesse em servir</h3>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{demoInteresses[0].person}</span> quer
                    aprender <span className="font-medium">{demoInteresses[0].position}</span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {demoInteresses[0].note}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </section>
        )}

        <p className="px-1 pt-2 text-center text-xs text-muted-foreground">
          Modo demonstração · dados de exemplo
        </p>
      </div>
    </>
  );
}

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "primary" | "warning" | "accent";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary bg-primary/10"
      : tone === "warning"
        ? "text-warning bg-warning/12"
        : "text-accent bg-accent/12";
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
        <span className={`inline-flex size-9 items-center justify-center rounded-full ${toneClass}`}>
          {icon}
        </span>
        <span className="text-xl font-semibold leading-none">{value}</span>
        <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
