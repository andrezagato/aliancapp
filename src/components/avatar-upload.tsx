"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { AchievementCelebration } from "@/components/achievement-celebration";
import { markSeen } from "@/lib/achievements-seen";
import { atualizarFotoPerfil, removerFotoPerfil } from "@/lib/actions";
import { splitCelebrations, type UnlockedBadge } from "@/lib/achievements";
import { cn } from "@/lib/utils";

/** Lado maior do avatar depois do corte — o app mostra 80px, 2x cobre retina. */
const MAX_SIDE = 320;
const QUALITY = 0.82;

/**
 * Foto de celular vem com vários MB e o avatar aparece do tamanho de uma moeda.
 * Cortar no quadrado e comprimir AQUI (antes de subir) é o que faz o upload
 * funcionar no 4G da igreja: ~20-50KB em vez de 4MB.
 */
async function comprimir(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const lado = Math.min(bitmap.width, bitmap.height); // corte quadrado central
  const canvas = document.createElement("canvas");
  canvas.width = MAX_SIDE;
  canvas.height = MAX_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - lado) / 2,
    (bitmap.height - lado) / 2,
    lado,
    lado,
    0,
    0,
    MAX_SIDE,
    MAX_SIDE,
  );
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export function AvatarUpload({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<UnlockedBadge[]>([]);
  const [pending, start] = useTransition();
  const [working, setWorking] = useState(false);
  const busy = pending || working;

  async function escolher(file: File) {
    setWorking(true);
    try {
      const menor = await comprimir(file);
      setPreview(URL.createObjectURL(menor));
      const form = new FormData();
      form.append("foto", menor);
      const r = await atualizarFotoPerfil(form);
      if (!r.ok) {
        setPreview(null);
        showToast(r.error);
        return;
      }
      if (r.unlocked && r.unlocked.length > 0) {
        markSeen(r.unlocked.map((b) => b.code));
        const { full, toasts } = splitCelebrations(r.unlocked);
        if (full.length > 0) setCelebrate(full);
        // "Perfil completo" é toast: a foto já é a recompensa visível na tela
        for (const b of toasts) showToast(`${b.emoji} ${b.title} — a equipe te reconhece 💛`);
        if (full.length === 0 && toasts.length === 0) showToast("Foto nova no ar 📸");
      } else {
        showToast("Foto nova no ar 📸");
      }
      setOpen(false);
      start(() => router.refresh());
    } catch {
      setPreview(null);
      showToast("Não foi possível usar essa imagem. Tente outra.");
    } finally {
      setWorking(false);
    }
  }

  function remover() {
    setWorking(true);
    removerFotoPerfil()
      .then((r) => {
        if (!r.ok) {
          showToast(r.error);
          return;
        }
        setPreview(null);
        setOpen(false);
        showToast("Foto removida.");
        start(() => router.refresh());
      })
      .finally(() => setWorking(false));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={src || preview ? "Trocar foto do perfil" : "Adicionar foto do perfil"}
        className="press-sm relative rounded-full"
      >
        <Avatar name={name} src={preview ?? src} className={className} />
        <span
          className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full bg-accent text-accent-foreground shadow-soft"
          aria-hidden
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </span>
      </button>

      <Modal open={open} onClose={() => (busy ? undefined : setOpen(false))} sheet title="Sua foto">
        <p className="mt-1 text-sm text-muted-foreground">
          É assim que a equipe te reconhece na escala e no chat.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // deixa reescolher o MESMO arquivo depois
            if (f) void escolher(f);
          }}
        />
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="press-sm inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-primary text-[15px] font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {src || preview ? "Escolher outra foto" : "Escolher uma foto"}
          </button>
          {src || preview ? (
            <button
              type="button"
              disabled={busy}
              onClick={remover}
              className={cn(
                "press-sm inline-flex h-11 items-center justify-center gap-2 rounded-[14px]",
                "border border-destructive/30 text-sm font-semibold text-destructive-ink disabled:opacity-60",
              )}
            >
              <Trash2 className="size-4" /> Remover foto
            </button>
          ) : null}
        </div>
      </Modal>

      <AchievementCelebration badges={celebrate} onDone={() => setCelebrate([])} />
    </>
  );
}
