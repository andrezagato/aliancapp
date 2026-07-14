import { TopBar } from "@/components/app-shell/top-bar";
import { DisponibilidadeManager } from "@/components/disponibilidade-manager";
import { getSession } from "@/lib/auth";
import { getMyAvailabilityBlocks, getMyUpcomingAssignments } from "@/lib/data";

export default async function DisponibilidadePage() {
  const session = await getSession();
  if (!session) return null;
  const [blocks, mine] = await Promise.all([
    getMyAvailabilityBlocks(session),
    getMyUpcomingAssignments(session),
  ]);
  const scheduled = mine.map((a) => ({ eventTitle: a.eventTitle, startsAt: a.startsAt }));

  return (
    <>
      <TopBar
        title="Quando não posso"
        subtitle="Marque os dias que você não está disponível"
        userName={session.profile.full_name || "?"}
      />
      <div className="animate-fade-in py-4">
        <DisponibilidadeManager blocks={blocks} scheduled={scheduled} />
      </div>
    </>
  );
}
