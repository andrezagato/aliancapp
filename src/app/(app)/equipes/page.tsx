import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getManageableTeams, listChurchProfiles } from "@/lib/data";
import { TeamManager } from "@/components/team-manager";

export default async function EquipesPage() {
  const session = await getSession();
  if (!session) return null;
  // Admin gerencia tudo; líder gerencia as equipes que lidera. Voluntário não entra.
  if (session.role === "volunteer") redirect("/inicio");

  const [teams, profiles] = await Promise.all([getManageableTeams(session), listChurchProfiles()]);

  return (
    <div className="animate-fade-in space-y-4 py-3">
      <Link href="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Perfil
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Monte a equipe</h1>
        <p className="text-muted-foreground">
          {session.role === "admin"
            ? "Crie equipes e defina as funções de cada ministério."
            : "Defina as funções da sua equipe. As posições valem na hora de escalar."}
        </p>
      </div>
      <TeamManager teams={teams} allProfiles={profiles} canCreateTeam={session.role === "admin"} />
    </div>
  );
}
