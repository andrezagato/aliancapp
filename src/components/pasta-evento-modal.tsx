"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { definirPastaArquivos } from "@/lib/actions";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Vincula a pasta de arquivos do culto (OneDrive/Drive).
 *
 * Era o miolo do `EventFilesCard` — uma fileira de três ícones redondos (pasta,
 * escala, engrenagem) grudada no cabeçalho "Ordem do culto". A fileira morreu em
 * 09/08: os três viraram linhas COM RÓTULO dentro do menu do culto, que era o
 * pedido do André ("fica mais limpo") e de quebra resolve a engrenagem — ícone
 * que ninguém decifra sozinho e que ele achava ruim. Sobrou só o modal.
 */
export function PastaModal({ eventId, url, onClose }: { eventId: string; url: string | null; onClose: () => void }) {
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
        {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
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
            className="press-sm inline-flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-destructive-ink"
          >
            Remover pasta
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
