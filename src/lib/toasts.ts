/**
 * Mensagens de toast calorosas e ROTATIVAS por tipo de ação — pra cada ação dar
 * uma sensação humana/encorajadora em vez de um "salvo" seco. `warm(kind)` pega
 * uma variante aleatória do grupo (roda no cliente, então Math.random é ok).
 *
 * Regra de tom: comemorar o positivo, acolher o negativo, nunca culpar. Erros
 * NÃO passam por aqui — erro é claro e direto (mostramos r.error como está).
 */
const MSGS: Record<string, string[]> = {
  presencaConfirmada: [
    "Mandou bem! A gente se vê lá 🙌",
    "Show! Contamos com você 💛",
    "Confirmado! Vai ser especial 🔥",
    "Isso! Sua presença faz diferença ✨",
  ],
  presencaRecusada: [
    "Que pena! Te vemos na próxima 🙏",
    "Tudo bem — obrigado por avisar 💛",
    "Sem problema, fica pra próxima!",
    "Valeu por avisar cedo — ajuda demais 🙏",
  ],
  checkin: [
    "Chegou! Bom culto 🙌",
    "Presença marcada — arrasa hoje! 🔥",
    "Tá on! Que seja um culto lindo 💛",
    "Boa! Deus abençoe o seu servir ✨",
  ],
  eventoCriado: [
    "Boa! Evento criado — vai ser demais 🎉",
    "Prontinho! Mais um culto no mapa 🗓️",
    "Criado! Agora é montar a escala 💪",
  ],
  eventoArquivado: ["Arquivado — guardado no histórico 📦", "Feito! Fica guardadinho."],
  eventoReativado: ["De volta à ativa! 🙌", "Reativado — bora de novo!"],
  eventoExcluido: ["Evento excluído.", "Pronto, removido."],
  responsavelConfirmou: [
    "Combinado! Obrigado por assumir 🙌",
    "Show! Pode contar com a gente 💛",
    "Confirmado — vai ser um culto lindo ✨",
  ],
  escalaSalva: ["Escala atualizada ✨", "Prontinho, salvo 💛", "Feito! ✅"],
  salvo: ["Salvo! ✨", "Prontinho 💛", "Feito! ✅"],
};

export function warm(kind: keyof typeof MSGS | string, fallback = "Feito! ✅"): string {
  const arr = MSGS[kind];
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.floor(Math.random() * arr.length)];
}
