"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { useToast } from "@/components/ui/toast";
import { solicitarEvento, resolverEventoSolicitado } from "@/lib/actions";
import { warm } from "@/lib/toasts";
import { fmtEventWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PendingEventRequest } from "@/lib/data";

export type TeamOption = { id: string; name: string; color: string };

const inputCls =
  "w-full rounded-[14px] border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary";

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

// -----------------------------------------------------------------------------
// Formulário de sugestão de evento (reusado no botão e no calendário)
// -----------------------------------------------------------------------------
export function SugerirEventoForm({
  teams,
  initialDate = "",
  onDone,
}: {
  teams: TeamOption[];
  initialDate?: string;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggleTeam = (id: string) => setTeamIds((s) => (s.includes(id) ? s.filter((t) => t !== id) : [...s, id]));
  const canSubmit = title.trim().length > 1 && !!date;

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await solicitarEvento({ title, date, time, location, note, teamIds });
      if (r.ok) {
        showToast(warm("pedidoEnviado"));
        onDone();
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <Field label="Título">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ensaio geral" className={inputCls} />
      </Field>
      <div className="flex gap-2">
        <Field label="Data" className="flex-1">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Hora" className="w-32">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Local (opcional)">
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Templo" className={inputCls} />
      </Field>

      {teams.length > 0 ? (
        <div>
          <p className="mb-1.5 text-sm font-medium">Equipes que vão servir</p>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                  teamIds.includes(t.id)
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                <TeamDot color={t.color} /> {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="Observação (opcional)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Algo que ajude a administração a decidir"
          className={cn(inputCls, "resize-none")}
        />
      </Field>
      {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
      <button
        onClick={submit}
        disabled={pending || !canSubmit}
        className={cn(
          "press h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold",
          canSubmit ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        {pending ? "Enviando…" : "Enviar pedido"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Botão compacto (só ícone) que abre o mesmo formulário — usado ao lado de
// "ver o mês inteiro" na aba Escalas.
// -----------------------------------------------------------------------------
export function SugerirEventoIconButton({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sugerir evento"
        className="press-sm inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Plus className="size-[18px]" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} sheet title="Sugerir evento">
        <div className="mt-1">
          <SugerirEventoForm
            teams={teams}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Admin: caixa de entrada dos pedidos de evento
// -----------------------------------------------------------------------------
export function EventRequestInbox({ requests }: { requests: PendingEventRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Pedidos de evento</h3>
      <div className="space-y-2">
        {requests.map((r) => (
          <EventRequestCard key={r.id} req={r} />
        ))}
      </div>
    </section>
  );
}

function EventRequestCard({ req }: { req: PendingEventRequest }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const resolve = (aprovar: boolean) => {
    start(async () => {
      const r = await resolverEventoSolicitado(req.id, aprovar, note);
      if (r.ok) {
        setOpen(false);
        setNote("");
        showToast(warm(aprovar ? "eventoAprovado" : "pedidoRecusado"));
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{req.title}</p>
        <span className="text-sm capitalize text-muted-foreground">
          {req.desiredAt ? fmtEventWhen(req.desiredAt) : "sem data"}
        </span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Pedido de {req.requesterName}</p>
      {req.location ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" /> {req.location}
        </p>
      ) : null}
      {req.note ? <p className="mt-1 text-[13px] italic text-muted-foreground">“{req.note}”</p> : null}
      <button
        onClick={() => setOpen(true)}
        className="press-sm mt-3 rounded-[12px] border border-border px-3.5 py-2 text-sm font-bold text-primary"
      >
        Responder
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)} sheet title="Responder pedido">
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{req.title}</span>
          {req.desiredAt ? <> · {fmtEventWhen(req.desiredAt)}</> : null} — pedido de {req.requesterName}.
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Ao aprovar, o evento entra no calendário. Você ajusta as equipes na escala quando quiser.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Mensagem pra quem pediu (opcional)"
          className={cn(inputCls, "mt-3 resize-none")}
        />
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => resolve(false)}
            disabled={pending}
            className="press h-[50px] flex-1 rounded-[14px] border border-destructive/30 bg-card text-[15px] font-bold text-destructive-ink"
          >
            Recusar
          </button>
          <button
            onClick={() => resolve(true)}
            disabled={pending}
            className="press h-[50px] flex-1 rounded-[14px] bg-success text-[15px] font-extrabold text-white"
          >
            {pending ? "…" : "Aprovar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
