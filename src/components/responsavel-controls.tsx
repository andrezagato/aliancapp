"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, UserCog, Clock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { definirResponsavel, confirmarEvento, responderResponsavel } from "@/lib/actions";

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
  const [responder, setResponder] = useState(false);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");

  function run(fn: () => Promise<{ ok: boolean }>) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setPicking(false);
        setResponder(false);
        setNote("");
        router.refresh();
      }
    });
  }

  const filtered = profiles.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mt-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
      {responsibleName ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Responsável:</span>
          <span className="font-medium">{responsibleName}</span>
          {confirmedAt ? (
            <span className="inline-flex items-center gap-1 text-success">
              <BadgeCheck className="size-4" /> confirmou
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning">
              <Clock className="size-4" /> a confirmar
            </span>
          )}
          {isAdmin ? (
            <button
              onClick={() => run(() => definirResponsavel(eventId, null))}
              disabled={pending}
              aria-label="Remover responsável"
              className="press-sm ml-auto grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
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

      {/* Convite pra VOCÊ ser o responsável */}
      {isResponsible && !confirmedAt ? (
        <div className="mt-2 rounded-xl border border-accent/40 bg-accent/15 p-3">
          <p className="text-sm font-medium">Você foi convidado a ser o responsável deste culto.</p>
          <button
            onClick={() => setResponder(true)}
            disabled={pending}
            className="press mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            Responder
          </button>
        </div>
      ) : null}

      {isResponsible && confirmedAt ? (
        <button
          onClick={() => run(() => confirmarEvento(eventId, false))}
          disabled={pending}
          className="press-sm mt-2 text-xs text-muted-foreground hover:underline disabled:opacity-50"
        >
          Desmarcar confirmação
        </button>
      ) : null}

      {/* Modal: escolher responsável (admin) */}
      <Modal open={picking} onClose={() => !pending && setPicking(false)} sheet title="Definir responsável">
        <div className="mt-1 space-y-2">
          <input
            autoFocus
            className="w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => definirResponsavel(eventId, p.id))}
                  className="press-sm flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <Avatar name={p.name} src={p.avatarUrl} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* Modal: responder o convite de responsável */}
      <Modal open={responder} onClose={() => !pending && setResponder(false)} sheet title="Você é o responsável">
        <div className="mt-1 space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirme que o culto vai acontecer — ou avise se não vai poder. Pode deixar uma mensagem pro admin.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Mensagem pro admin (opcional)"
            className="w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => run(() => responderResponsavel(eventId, true, note))}
            disabled={pending}
            className="press flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] bg-success text-[15.5px] font-extrabold text-white disabled:opacity-60"
          >
            <Check className="size-5" strokeWidth={2.8} /> Confirmar que vai acontecer
          </button>
          <button
            onClick={() => run(() => responderResponsavel(eventId, false, note))}
            disabled={pending}
            className="press-sm h-11 w-full rounded-[13px] border border-border text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            Não vou poder ser responsável
          </button>
        </div>
      </Modal>
    </div>
  );
}
