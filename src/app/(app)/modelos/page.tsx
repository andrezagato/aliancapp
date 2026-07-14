import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listTemplates, listTeams } from "@/lib/data";
import { ModelosManager } from "@/components/modelos-manager";

export default async function ModelosPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "admin") redirect("/escalas");

  const [templates, teams] = await Promise.all([listTemplates(), listTeams()]);
  const teamOpts = teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));

  return (
    <div className="animate-fade-in space-y-4 py-3">
      <Link href="/escalas/novo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Novo evento
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Modelos de evento</h1>
        <p className="text-muted-foreground">
          Salve os eventos que se repetem (equipes + horário) para criar rapidinho depois.
        </p>
      </div>
      <ModelosManager templates={templates} teams={teamOpts} />
    </div>
  );
}
