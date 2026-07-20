/** Normaliza um telefone BR pro formato do wa.me (com país). */
export function waNumberBR(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  // 10–11 dígitos = DDD+número (sem país) → prefixa 55; 12–13 = já veio com o país.
  // Decidir pelo TAMANHO (não por "começa com 55") evita quebrar DDD 55 (Santa Maria/RS).
  const num = d.length === 10 || d.length === 11 ? `55${d}` : d;
  if (num.length < 12 || num.length > 13) return null;
  return num;
}

/** Link wa.me pra conversa individual (com mensagem opcional pronta). */
export function waLink(phone: string, message?: string): string | null {
  const num = waNumberBR(phone);
  if (!num) return null;
  return `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
