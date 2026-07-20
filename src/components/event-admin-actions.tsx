"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { arquivarEvento, excluirEvento } from "@/lib/actions";

/**
 * Ações do admin no evento: arquivar/reativar (some das listas, mantém histórico)
 * e excluir de vez (confirmação em 2 toques; assignments/requisitos caem junto).
 */
export function EventAdminActions({ eventId, archived }: { eventId: string; archived: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, start] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);

  const toggleArchive = () =>
    start(async () => {
      const r = await arquivarEvento(eventId, !archived);
      if (r.ok) {
        showToast(archived ? "Evento reativado." : "Evento arquivado.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  const del = () =>
    start(async () => {
      const r = await excluirEvento(eventId);
      if (r.ok) {
        showToast("Evento excluído.");
        router.push("/escalas");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={toggleArchive}
        disabled={busy}
        className="press-sm inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground disabled:opacity-60"
      >
        {archived ? (
          <>
            <ArchiveRestore className="size-4" /> Reativar
          </>
        ) : (
          <>
            <Archive className="size-4" /> Arquivar
          </>
        )}
      </button>

      {confirmDel ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Excluir de vez?</span>
          <button
            onClick={() => setConfirmDel(false)}
            disabled={busy}
            className="press-sm rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={del}
            disabled={busy}
            className="press-sm rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-60"
          >
            Excluir
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirmDel(true)}
          disabled={busy}
          className="press-sm inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1.5 text-sm font-semibold text-destructive disabled:opacity-60"
        >
          <Trash2 className="size-4" /> Excluir
        </button>
      )}
    </div>
  );
}
