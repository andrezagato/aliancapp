import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listTeamsWithPositions } from "@/lib/data";
import { NovoEventoForm } from "@/components/novo-evento-form";

export default async function NovoEventoPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "admin") redirect("/escalas");

  const teams = await listTeamsWithPositions();

  return (
    <div className="animate-fade-in space-y-4 py-3">
      <Link href="/escalas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Escalas
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Novo evento</h1>
        <p className="text-muted-foreground">Crie um culto ou evento avulso e defina a escala.</p>
      </div>
      <NovoEventoForm teams={teams} />
    </div>
  );
}
