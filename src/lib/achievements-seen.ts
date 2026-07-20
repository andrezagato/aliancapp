// Controle client-side de quais conquistas já foram COMEMORADAS neste aparelho,
// pra não repetir a celebração a cada login. (O desbloqueio em si vive no banco.)
const KEY = "sirvo-conquistas-vistas-v1";

export function getSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markSeen(codes: string[]): void {
  try {
    const s = getSeen();
    codes.forEach((c) => s.add(c));
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* localStorage indisponível */
  }
}
