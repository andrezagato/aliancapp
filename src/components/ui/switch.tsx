"use client";

import { cn } from "@/lib/utils";

/**
 * Interruptor do sistema (vinho ligado, areia desligado, botão de creme com
 * sombra macia). Nasceu dentro de `notification-prefs.tsx` e saiu pra cá quando
 * o consentimento de WhatsApp passou a precisar do mesmo pixel — dois
 * interruptores com aparência quase-igual são pior que um compartilhado.
 */
/**
 * Sem `disabled` de propósito: interruptor desabilitado não dá feedback nenhum
 * ao toque no celular e lê como app quebrado. O padrão do Sirvo pra canal
 * indisponível é trocar o controle por um traço, com a razão à vista ao lado.
 */
export function Switch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-card shadow-soft transition-transform duration-150",
          on ? "translate-x-[1.125rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
