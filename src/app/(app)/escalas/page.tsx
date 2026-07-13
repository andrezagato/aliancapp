import { CalendarDays } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { EmptyState } from "@/components/empty-state";
import { demoUser } from "@/lib/demo";

export default function EscalasPage() {
  return (
    <>
      <TopBar title="Escalas" userName={demoUser.fullName} unread={3} />
      <div className="animate-fade-in py-4">
        <EmptyState
          icon={<CalendarDays className="size-7" />}
          title="Escalas por evento"
          description="Aqui vão aparecer os cultos e a escala de cada equipe — escalar, confirmar, cancelar e trocar."
          phase="Chega na Fase 1"
        />
      </div>
    </>
  );
}
