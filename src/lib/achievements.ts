// Catálogo de conquistas ("Minha Jornada"). Módulo puro (sem server-only) — o
// client usa pra renderizar emoji/título/descrição; o server usa as métricas
// pra decidir o que está desbloqueado. Foco: tempo de VOLUNTARIADO e
// participação nas equipes — uma válvula de escape divertida do processo.

export type BadgeMetric =
  | "cadastro"
  | "escalado"
  | "servido"
  | "checkin"
  | "streak"
  | "ministerios"
  | "salvou"
  | "rapida"
  | "meses"
  | "lider"
  | "interesses"
  | "maratona";

export type Badge = {
  code: string;
  emoji: string;
  title: string;
  desc: string;
  metric: BadgeMetric;
  target: number;
};

export type JourneyMetrics = Record<BadgeMetric, number>;

export const BADGES: Badge[] = [
  { code: "cadastro", emoji: "🎉", title: "Bem-vindo ao time!", desc: "Você faz parte do Servir.", metric: "cadastro", target: 1 },
  { code: "primeira_escala", emoji: "📌", title: "Primeira escala", desc: "Você foi escalado pela primeira vez.", metric: "escalado", target: 1 },
  { code: "serviu_1", emoji: "🌱", title: "Estreia no culto", desc: "Serviu pela primeira vez.", metric: "servido", target: 1 },
  { code: "primeiro_checkin", emoji: "✅", title: "Presente!", desc: "Fez seu primeiro check-in.", metric: "checkin", target: 1 },
  { code: "serviu_5", emoji: "⭐", title: "Pegando o ritmo", desc: "5 cultos servidos.", metric: "servido", target: 5 },
  { code: "serviu_10", emoji: "🏅", title: "Dez de fé", desc: "10 cultos servidos.", metric: "servido", target: 10 },
  { code: "serviu_25", emoji: "🥈", title: "Veterano(a)", desc: "25 cultos servidos.", metric: "servido", target: 25 },
  { code: "serviu_50", emoji: "🥇", title: "Meio-cento!", desc: "50 cultos servidos.", metric: "servido", target: 50 },
  { code: "serviu_100", emoji: "💯", title: "Lenda do servir", desc: "100 cultos servidos.", metric: "servido", target: 100 },
  { code: "fiel_3", emoji: "🔥", title: "Chama acesa", desc: "3 cultos seguidos.", metric: "streak", target: 3 },
  { code: "fiel_6", emoji: "🔥", title: "Fidelidade em dobro", desc: "6 cultos seguidos.", metric: "streak", target: 6 },
  { code: "multi_2", emoji: "🌍", title: "Faz de tudo", desc: "Serviu em 2 ministérios.", metric: "ministerios", target: 2 },
  { code: "multi_3", emoji: "🌟", title: "Multiministério", desc: "Serviu em 3 ministérios.", metric: "ministerios", target: 3 },
  { code: "salvou_culto", emoji: "🦸", title: "Salvou o culto", desc: "Topou cobrir de última hora.", metric: "salvou", target: 1 },
  { code: "resposta_rapida", emoji: "⚡", title: "Resposta relâmpago", desc: "Confirmou rapidinho 3 vezes.", metric: "rapida", target: 3 },
  { code: "voluntario_6m", emoji: "📅", title: "Meio ano de estrada", desc: "6 meses servindo.", metric: "meses", target: 6 },
  { code: "voluntario_1a", emoji: "🎂", title: "1 ano servindo!", desc: "Um ano de caminhada.", metric: "meses", target: 12 },
  { code: "fiel_12", emoji: "🕯️", title: "Chama que não apaga", desc: "12 cultos seguidos!", metric: "streak", target: 12 },
  { code: "multi_4", emoji: "🌈", title: "Curinga da igreja", desc: "Serviu em 4 ministérios.", metric: "ministerios", target: 4 },
  { code: "explorador", emoji: "🧭", title: "Explorador", desc: "Sinalizou interesse em servir.", metric: "interesses", target: 1 },
  { code: "lider", emoji: "👑", title: "Vestiu a camisa", desc: "Virou líder de uma equipe.", metric: "lider", target: 1 },
  { code: "maratona_3", emoji: "🗓️", title: "Maratona do mês", desc: "Serviu 3 vezes num mês só.", metric: "maratona", target: 3 },
  { code: "maratona_5", emoji: "🏃", title: "Fôlego de sobra", desc: "Serviu 5 vezes num mês só.", metric: "maratona", target: 5 },
];

export type UnlockedBadge = { code: string; emoji: string; title: string; desc: string };

/** Metadados prontos pra celebração (ou null se o código não existir). */
export function unlockedBadge(code: string): UnlockedBadge | null {
  const b = BADGE_BY_CODE[code];
  return b ? { code: b.code, emoji: b.emoji, title: b.title, desc: b.desc } : null;
}

export const BADGE_BY_CODE: Record<string, Badge> = Object.fromEntries(BADGES.map((b) => [b.code, b]));

/** Códigos desbloqueados dado o conjunto de métricas. */
export function earnedCodes(m: JourneyMetrics): string[] {
  return BADGES.filter((b) => (m[b.metric] ?? 0) >= b.target).map((b) => b.code);
}
