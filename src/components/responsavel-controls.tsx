"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, UserCog, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { definirResponsavel, confirmarEvento } from "@/lib/actions";

type Profile = { id: string; name: string; avatarUrl: string | null };

export function ResponsavelControls({
  eventId,
  isAdmin,
  isResponsible,
  responsibleName,
  confirmedAt,
  profiles,
}: {
  eventId: string;
  isAdmin: boolean;
  isResponsible: boolean;
  responsibleName: string | null;
  confirmedAt: string | null;
  profiles: Profile[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");

  const canConfirm = isResponsible || isAdmin;

  function run(fn: () => Promise<{ ok: boolean }>) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setPicking(false);
        router.refresh();
      }
    });
  }

  const filtered = profiles.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mt-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
      {responsibleName ? (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Responsável:</span>
            <span className="font-medium">{responsibleName}</span>
            {confirmedAt ? (
              <span className="inline-flex items-center gap-1 text-success">
                <BadgeCheck className="size-4" /> confirmou que vai acontecer
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning">
                <Clock className="size-4" /> a confirmar
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {canConfirm ? (
              confirmedAt ? (
                <Button size="sm" variant="ghost" onClick={() => run(() => confirmarEvento(eventId, false))} disabled={pending}>
                  Desmarcar confirmação
                </Button>
              ) : (
                <Button size="sm" onClick={() => run(() => confirmarEvento(eventId, true))} disabled={pending}>
                  <BadgeCheck className="size-4" /> Confirmar que vai acontecer
                </Button>
              )
            ) : null}
            {isAdmin ? (
              <Button size="sm" variant="outline" onClick={() => setPicking(true)} disabled={pending}>
                <UserCog className="size-4" /> Trocar
              </Button>
            ) : null}
            {isAdmin ? (
              <Button size="sm" variant="ghost" onClick={() => run(() => definirResponsavel(eventId, null))} disabled={pending}>
                Remover
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Responsável:</span>
          {isAdmin ? (
            <Button size="sm" variant="outline" onClick={() => setPicking(true)} disabled={pending}>
              <UserCog className="size-4" /> Definir responsável
            </Button>
          ) : (
            <span className="text-muted-foreground">a definir</span>
          )}
        </div>
      )}

      <Modal open={picking} onClose={() => !pending && setPicking(false)}>
        <div className="flex max-h-[80dvh] flex-col rounded-2xl border border-border bg-card shadow-lift">
          <div className="border-b border-border p-4">
            <h3 className="text-lg font-semibold">Definir responsável</h3>
            <input
              autoFocus
              className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Buscar…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => definirResponsavel(eventId, p.id))}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-muted disabled:opacity-50"
                  >
                    <Avatar name={p.name} src={p.avatarUrl} className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border p-3">
            <Button variant="ghost" className="w-full" onClick={() => setPicking(false)} disabled={pending}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
