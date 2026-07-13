import type { AssignmentStatus } from "@/lib/supabase/database.types";

/**
 * Dados de DEMONSTRAÇÃO pro shell renderizar antes do Supabase estar plugado.
 * Espelha o supabase/seed.sql. Persona: Marcos, líder do Louvor.
 * TODO (Fase 1): substituir por queries reais ao Supabase.
 */

export const demoUser = {
  name: "Marcos",
  fullName: "Marcos Andrade",
  roleLabel: "Líder · Louvor",
};

export type DemoSlot = {
  team: string;
  teamColor: string;
  position: string;
  person: string | null;
  status: AssignmentStatus;
};

export const demoEvent = {
  title: "Culto de Domingo",
  weekdayLabel: "Domingo",
  dateLabel: "18 de julho · 18h",
  location: "Templo",
};

// Escala da equipe do Marcos (Louvor) — voluntário vê só a própria equipe.
export const demoEscala: DemoSlot[] = [
  { team: "Louvor", teamColor: "#C4633E", position: "Vocal", person: "Juliana", status: "confirmado" },
  { team: "Louvor", teamColor: "#C4633E", position: "Guitarra", person: "Pedro", status: "convidado" },
  { team: "Louvor", teamColor: "#C4633E", position: "Baixo", person: "Rafael", status: "confirmado" },
  { team: "Louvor", teamColor: "#C4633E", position: "Bateria", person: null, status: "vaga_aberta" },
  { team: "Louvor", teamColor: "#C4633E", position: "Teclado", person: "Sara", status: "recusado" },
];

export const demoPendencias = {
  aguardandoConfirmacao: 1,
  vagasAbertas: 1,
  recusas: 1,
};

export const demoInteresses = [
  { person: "Juliana", position: "Teclado", note: "Quer começar a treinar :)" },
];

export const demoTeams = [
  { name: "Louvor", color: "#C4633E", icon: "music", count: 6 },
  { name: "Som", color: "#5B6B4E", icon: "sliders", count: 3 },
  { name: "Recepção", color: "#B0894A", icon: "hand-heart", count: 4 },
  { name: "Kids", color: "#7C6BAF", icon: "baby", count: 5 },
];
