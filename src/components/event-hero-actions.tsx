"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { arquivarEvento, excluirEvento } from "@/lib/actions";

const heroBtn =
  "press-sm grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 disabled:opacity-60";

/** Ícones do admin no canto do hero: arquivar/reativar e excluir (com confirmação). */
export function EventHeroActions({ eventId, archived }: { eventId: string; archived: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, start] = useTransition();

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
    <div className="absolute right-3 top-3 z-10 flex gap-1.5">
      <button
        onClick={() => window.confirm(archived ? "Reativar este evento?" : "Arquivar este evento?") && toggleArchive()}
        disabled={busy}
        aria-label={archived ? "Reativar" : "Arquivar"}
        className={heroBtn}
      >
        {archived ? <ArchiveRestore className="size-[18px]" /> : <Archive className="size-[18px]" />}
      </button>
      <button
        onClick={() => window.confirm("Excluir o evento de vez? Não dá pra desfazer.") && del()}
        disabled={busy}
        aria-label="Excluir"
        className={heroBtn}
      >
        <Trash2 className="size-[18px]" />
      </button>
    </div>
  );
}
