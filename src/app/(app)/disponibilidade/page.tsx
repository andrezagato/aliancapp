import { CalendarX2 } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { EmptyState } from "@/components/empty-state";
import { getSession } from "@/lib/auth";

export default async function DisponibilidadePage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <>
      <TopBar
        title="Quando não posso"
        subtitle="Marque os dias que você não está disponível"
        userName={session.profile.full_name || "?"}
      />
      <div className="animate-fade-in py-4">
        <EmptyState
          icon={<CalendarX2 className="size-7" />}
          title="Sua disponibilidade"
          description="Bloqueie datas de viagem ou compromissos. O líder vê isso na hora de escalar e evita te colocar num dia que você não pode."
          phase="Chega na Fase 2"
        />
      </div>
    </>
  );
}
