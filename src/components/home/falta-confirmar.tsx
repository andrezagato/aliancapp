import { Avatar } from "@/components/ui/avatar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import type { UnconfirmedPerson } from "@/lib/data";

function diasDesde(iso: string): string {
  const dias = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (dias === 0) return "convidado hoje";
  if (dias === 1) return "convidado há 1 dia";
  return `convidado há ${dias} dias`;
}

/**
 * "Falta confirmar" (Fase 5 do pós-audit) — quem está `convidado` no próximo
 * culto da equipe (líder) ou da igreja (admin), pra resolver de pé, com pressa,
 * sem abrir mais nada. Um WhatsApp por pessoa: um link só não cobra várias
 * pessoas de uma vez, então não tem "cobrar todos" — cada linha resolve a sua.
 */
export function FaltaConfirmarCard({ people }: { people: UnconfirmedPerson[] }) {
  if (people.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">
        Falta confirmar <span className="text-muted-foreground">· {people.length}</span>
      </h3>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {people.map((p) => (
            <li key={p.assignmentId} className="flex items-center gap-3 p-3.5">
              <Avatar name={p.name} src={p.avatarUrl} className="size-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.teamName} · {p.positionName} · {diasDesde(p.invitedAt)}
                </p>
              </div>
              <WhatsAppButton
                phone={p.phone}
                message={`Oi ${p.name.split(/\s+/)[0]}! Você foi convidado(a) pra servir — confirma sua presença? 🙏`}
                label=""
                className="shrink-0 px-2.5"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
