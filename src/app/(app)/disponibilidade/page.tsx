import { CalendarX2 } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { EmptyState } from "@/components/empty-state";
import { demoUser } from "@/lib/demo";

export default function DisponibilidadePage() {
  return (
    <>
      <TopBar
        title="Quando não posso"
        subtitle="Marque os dias que você não está disponível"
        userName={demoUser.fullName}
        unread={3}
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
