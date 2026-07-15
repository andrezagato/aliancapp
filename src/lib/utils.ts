import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Nomes curtos para avatar (iniciais). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Nome de exibição: apelido se houver, senão o nome completo. */
export function displayName(
  nickname: string | null | undefined,
  fullName: string | null | undefined,
): string {
  const nick = nickname?.trim();
  if (nick) return nick;
  return (fullName ?? "").trim() || "?";
}
