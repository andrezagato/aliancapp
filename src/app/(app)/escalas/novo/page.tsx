import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listTeamsWithPositions, listTemplates } from "@/lib/data";
import { NovoEventoForm } from "@/components/novo-evento-form";

export default async function NovoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "admin") redirect("/escalas");
  const sp = await searchParams;

  const [teams, templates] = await Promise.all([listTeamsWithPositions(), listTemplates()]);

  return (
    <div className="animate-fade-in space-y-3 py-3">
      <Link href="/escalas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Escalas
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Novo evento</h1>
          <p className="text-muted-foreground">Crie um culto ou evento e escolha as equipes.</p>
        </div>
        <Link
          href="/modelos"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LayoutTemplate className="size-4" /> Modelos
        </Link>
      </div>
      <NovoEventoForm teams={teams} templates={templates} initialDate={sp.data} />
    </div>
  );
}
