"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

/**
 * Linha editável do Perfil (Nome, Apelido…). A própria pessoa edita o próprio
 * campo; recebe a server action como prop. `required` impede salvar vazio.
 */
export function ProfileEditableField({
  label,
  current,
  placeholder,
  emptyHint,
  required = false,
  type = "text",
  displayValue,
  action,
}: {
  label: string;
  current: string | null;
  placeholder: string;
  emptyHint: string;
  required?: boolean;
  type?: "text" | "date";
  displayValue?: string;
  action: (value: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();

  function save() {
    if (required && !value.trim()) {
      showToast(`${label} não pode ficar vazio.`);
      return;
    }
    start(async () => {
      const r = await action(value);
      if (!r.ok) {
        showToast(r.error);
        return;
      }
      setEditing(false);
      showToast(`${label} salvo.`);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          autoFocus
          type={type}
          value={value}
          maxLength={type === "date" ? undefined : 60}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={save}
          disabled={pending}
          aria-label={`Salvar ${label.toLowerCase()}`}
          className="press-sm grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={() => setEditing(false)}
          aria-label="Cancelar"
          className="press-sm grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setValue(current ?? "");
        setEditing(true);
      }}
      className="press-sm flex w-full items-center gap-3 px-4 py-3.5 text-left"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-accent/15 text-accent">
        <Pencil className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {current?.trim() ? (displayValue ?? current) : emptyHint}
        </span>
      </span>
      <span className="shrink-0 text-[13px] font-bold text-primary">{current?.trim() ? "Editar" : "Adicionar"}</span>
    </button>
  );
}
