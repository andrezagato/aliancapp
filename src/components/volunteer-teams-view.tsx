import { Crown, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { EmptyState } from "@/components/empty-state";
import { WhatsAppButton } from "@/components/whatsapp-button";
import type { MyTeamRoster } from "@/lib/data";

/**
 * Visão do voluntário na aba Equipes: só leitura — quem serve com ele em cada
 * equipe, com botão de WhatsApp pra falar direto (comunicação da equipe).
 */
export function VolunteerTeamsView({ teams, meId }: { teams: MyTeamRoster[]; meId: string }) {
  if (teams.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-7" />}
        title="Você ainda não está em nenhuma equipe"
        description="Quando um líder te adicionar, sua equipe aparece aqui com todo mundo que serve junto."
      />
    );
  }

  return (
    <div className="space-y-3">
      {teams.map((t) => (
        <Card key={t.id} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <TeamDot color={t.color} className="size-3" />
            <h2 className="font-display text-[17px] font-bold">{t.name}</h2>
            <span className="ml-auto text-sm text-muted-foreground">{t.members.length}</span>
          </div>
          <ul className="divide-y divide-border/70">
            {t.members.map((m) => (
              <li key={m.profileId} className="flex items-center gap-3 p-3 pl-4">
                <Avatar name={m.name} src={m.avatarUrl} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {m.name}
                    {m.profileId === meId ? <span className="text-muted-foreground">(você)</span> : null}
                    {m.role === "leader" ? <Crown className="size-3.5 shrink-0 text-primary" /> : null}
                  </span>
                </span>
                {m.profileId !== meId ? (
                  <WhatsAppButton
                    phone={m.phone}
                    message={`Oi ${m.name.split(/\s+/)[0]}! 👋`}
                    className="h-8 shrink-0 px-2.5 text-[13px]"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
