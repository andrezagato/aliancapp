"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Pencil, Plus, ExternalLink } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { definirPastaArquivos } from "@/lib/actions";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * "Arquivos do culto" — mostra o link de uma pasta compartilhada (OneDrive/Drive)
 * do evento pra todos os escalados. Admin/Produção (canEdit) vinculam/editam.
 */
export function EventFilesCard({ eventId, url, canEdit }: { eventId: string; url: string | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  if (!url && !canEdit) return null;

  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-border bg-muted/30 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <FolderOpen className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Arquivos do culto</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
          >
            <ExternalLink className="size-3.5" /> Abrir pasta
          </a>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma pasta vinculada ainda.</p>
        )}
      </div>
      {canEdit ? (
        <button
          onClick={() => setEditing(true)}
          className="press-sm inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[13px] font-bold text-primary"
        >
          {url ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
          {url ? "Editar" : "Vincular"}
        </button>
      ) : null}
      {editing ? <EditModal eventId={eventId} url={url} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function EditModal({ eventId, url, onClose }: { eventId: string; url: string | null; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [value, setValue] = useState(url ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = (link: string) => {
    setError(null);
    startTx(async () => {
      const r = await definirPastaArquivos(eventId, link);
      if (r.ok) {
        onClose();
        router.refresh();
        showToast(link ? "Pasta vinculada ✓" : "Pasta removida");
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title="Pasta de arquivos do culto">
      <div className="mt-1 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Link da pasta (OneDrive, Drive…)</span>
          <input
            className={inputCls}
            placeholder="https://1drv.ms/..."
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <p className="text-[12px] text-muted-foreground">
          Crie uma pasta compartilhada com edição para “qualquer pessoa com o link” e cole aqui. Todos os
          escalados poderão abrir e subir arquivos.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          onClick={() => save(value)}
          disabled={pending}
          className="press h-[52px] w-full rounded-[15px] bg-primary text-[15.5px] font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {url ? (
          <button
            onClick={() => save("")}
            disabled={pending}
            className="press-sm inline-flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-destructive"
          >
            Remover pasta
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
