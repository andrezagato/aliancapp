"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { warm } from "@/lib/toasts";
import { confirmarEscalacao, recusarEscalacao, pedirTroca, listMembrosParaTroca } from "@/lib/actions";
import type { AssignmentStatus } from "@/lib/supabase/database.types";

const REASONS = ["Viajando", "Trabalho", "Saúde", "Compromisso", "Outro"];
type Sub = { profileId: string; name: string; avatarUrl: string | null; recusouAntes: boolean };

/**
 * Resposta do escalado — um único botão "Responder" que abre um sheet com
 * Confirmar presença OU "não vou poder" (motivo + sugerir substituto). Mesmo
 * padrão do sheet da home. Usado na escala (modal) e no histórico do líder.
 */
export function AssignmentResponse({
  assignmentId,
  status,
  teamId,
}: {
  assignmentId: string;
  status: AssignmentStatus;
  teamId: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [members, setMembers] = useState<Sub[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openSheet = () => {
    setError(null);
    setMotivo("");
    setChosen(null);
    setSubOpen(false);
    setOpen(true);
  };

  const loadSubs = async () => {
    setSubOpen(true);
    if (members === null) setMembers(await listMembrosParaTroca(teamId, assignmentId));
  };

  const confirmar = () => {
    setError(null);
    start(async () => {
      const r = await confirmarEscalacao(assignmentId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      showToast(warm("presencaConfirmada"));
      setOpen(false);
      router.refresh();
    });
  };

  const submitDecline = () => {
    if (motivo.trim().length < 3) return;
    setError(null);
    start(async () => {
      const r = chosen
        ? await pedirTroca(assignmentId, motivo, chosen)
        : await recusarEscalacao(assignmentId, motivo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      showToast(warm(chosen ? "trocaPedida" : "presencaRecusada"));
      setOpen(false);
      router.refresh();
    });
  };

  // --- gatilho (uma linha) ---
  if (status === "presente") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[12px] font-bold text-success-ink">
        <Check className="size-3.5" strokeWidth={3} /> Presente
      </span>
    );
  }
  if (status === "recusado") return <span className="shrink-0 text-[12px] text-muted-foreground">Você recusou</span>;
  if (status === "vaga_aberta") return null;

  const confirmed = status === "confirmado";

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(
          "press-sm inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold",
          confirmed
            ? "bg-success/12 text-success-ink"
            : "bg-primary text-primary-foreground",
        )}
      >
        {confirmed ? <Check className="size-3.5" strokeWidth={3} /> : null}
        {confirmed ? "Confirmado" : "Responder"}
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)} sheet title="Responder escala">
        <div className="mt-1 space-y-3">
          <button
            onClick={confirmar}
            disabled={pending}
            className="press flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] bg-success text-[15.5px] font-extrabold text-white disabled:opacity-60"
          >
            <Check className="size-5" strokeWidth={2.8} /> Confirmar presença
          </button>

          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[12px] font-semibold text-muted-foreground">ou, se não puder</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setMotivo(r === "Outro" ? "" : r)}
                className={cn(
                  "press rounded-full border px-3.5 py-2 text-sm font-bold",
                  motivo === r && r !== "Outro"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-destructive/25 bg-card text-primary",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Escreva o motivo…"
            className="w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-sm outline-none focus:border-primary"
          />

          {!subOpen ? (
            <button
              onClick={loadSubs}
              className="press-sm flex w-full items-center gap-2.5 rounded-[14px] border border-border bg-card px-3.5 py-3 text-left"
            >
              <Users className="size-[18px] text-muted-foreground" />
              <span className="flex-1 text-[13.5px] text-muted-foreground">
                Sugerir substituto <span className="text-muted-foreground/60">(opcional)</span>
              </span>
              <span className="text-[13px] font-bold text-primary">Escolher ›</span>
            </button>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-[14px] border border-border bg-card p-1.5">
              {members === null ? (
                <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
              ) : members.length > 0 ? (
                members.map((s) => {
                  const on = chosen === s.profileId;
                  return (
                    <button
                      key={s.profileId}
                      onClick={() => setChosen(on ? null : s.profileId)}
                      className={cn(
                        "press-sm flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left",
                        on && "bg-accent/20",
                      )}
                    >
                      <Avatar name={s.name} src={s.avatarUrl} className="size-9" />
                      <span className="flex-1 text-sm font-semibold">
                        {s.name}
                        {s.recusouAntes ? (
                          <span className="block text-[11px] font-medium text-muted-foreground">
                            já recusou este culto
                          </span>
                        ) : null}
                      </span>
                      {on ? <Check className="size-4 text-primary" strokeWidth={2.6} /> : null}
                    </button>
                  );
                })
              ) : (
                <p className="p-3 text-sm text-muted-foreground">Ninguém disponível pra sugerir agora.</p>
              )}
            </div>
          )}

          {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}

          <button
            onClick={submitDecline}
            disabled={pending || motivo.trim().length < 3}
            className={cn(
              "press h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold transition-opacity",
              motivo.trim().length >= 3
                ? "bg-destructive text-destructive-foreground"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            {chosen ? "Pedir troca" : "Não vou poder"}
          </button>
          <button onClick={() => setOpen(false)} className="press-sm h-10 w-full text-[14.5px] font-bold text-muted-foreground">
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
}
