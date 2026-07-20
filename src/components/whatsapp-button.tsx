"use client";

import { MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";

const base =
  "press-sm inline-flex h-9 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 text-sm font-bold text-success";

/** Botão que abre o WhatsApp da pessoa (some sozinho se o telefone for inválido). */
export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  className,
}: {
  phone: string | null | undefined;
  message?: string;
  label?: string;
  className?: string;
}) {
  const href = phone ? waLink(phone, message) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(base, className)}
    >
      <MessageCircle className="size-4" /> {label}
    </a>
  );
}

/** Botão que abre o grupo de WhatsApp da equipe (some sozinho se não houver link). */
export function WhatsAppGroupButton({
  href,
  label = "Grupo",
  className,
}: {
  href: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(base, className)}
    >
      <Users className="size-4" /> {label}
    </a>
  );
}
