// Os 19 tipos de aviso do banco agrupados em 4 ASSUNTOS que uma pessoa reconhece.
//
// Por que agrupar: `notification_kind` cresce por necessidade técnica (cada ação
// nova ganha o seu), mas ninguém quer 19 interruptores. O banco continua
// guardando preferência POR TIPO (nada trava no futuro) — o assunto é só a
// embalagem: mexer nele escreve a linha de cada tipo que ele contém.
//
// O sino NÃO aparece aqui de propósito: ele é o registro do que aconteceu e fica
// sempre ligado. Estes interruptores decidem o que te INTERROMPE (celular,
// e-mail). A coluna `in_app` existe no banco e é respeitada pelo `notificar()`,
// mas hoje nada no app a desliga.

import type { Database } from "@/lib/supabase/database.types";

type Kind = Database["public"]["Enums"]["notification_kind"];

export type TopicId = "escala" | "lembrete" | "equipe" | "celebracao";
export type TopicChannel = "push" | "email";

export type Topic = {
  id: TopicId;
  emoji: string;
  label: string;
  desc: string;
  kinds: Kind[];
  /** Canais que EXISTEM pra esse assunto (não mostra interruptor de mentira). */
  channels: TopicChannel[];
  /** "gestor" só aparece pra quem lidera equipe ou é admin. */
  audience: "todos" | "gestor";
};

export const NOTIFICATION_TOPICS: Topic[] = [
  {
    id: "escala",
    emoji: "📌",
    label: "Minha escala",
    desc: "Quando te escalam, quando muda ou cancela, e quando sua vaga é resolvida.",
    kinds: [
      "escalado",
      "evento_alterado",
      "evento_confirmar",
      "vaga_aberta",
      "troca_resolvida",
      "interesse_resolvido",
      "cadastro_aprovado",
    ],
    channels: ["push", "email"],
    audience: "todos",
  },
  {
    id: "lembrete",
    emoji: "⏰",
    label: "Lembrete de culto",
    desc: "O empurrãozinho pra confirmar presença antes do culto.",
    kinds: ["lembrete"],
    channels: ["push", "email"],
    audience: "todos",
  },
  {
    id: "equipe",
    emoji: "👥",
    label: "Minha equipe",
    desc: "Pedido de troca, quem quer servir, cadastro pra aprovar, evento novo pra sua equipe.",
    kinds: [
      "cadastro_pendente",
      "confirmado",
      "cancelado",
      "troca_solicitada",
      "interesse_servir",
      "evento_equipe",
      "evento_solicitado",
      "evento_resolvido",
      "cobertura",
    ],
    channels: ["push"],
    audience: "gestor",
  },
  {
    id: "celebracao",
    emoji: "🏆",
    label: "Conquistas e aniversários",
    desc: "As comemorações da caminhada — nada urgente.",
    kinds: ["conquista", "aniversario"],
    channels: ["push"],
    audience: "todos",
  },
];

export const TOPIC_BY_ID: Record<TopicId, Topic> = Object.fromEntries(
  NOTIFICATION_TOPICS.map((t) => [t.id, t]),
) as Record<TopicId, Topic>;

export type TopicPrefs = Record<TopicId, { push: boolean; email: boolean }>;

export function defaultTopicPrefs(): TopicPrefs {
  return Object.fromEntries(
    NOTIFICATION_TOPICS.map((t) => [t.id, { push: true, email: true }]),
  ) as TopicPrefs;
}
