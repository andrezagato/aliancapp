// Tipos compartilhados entre server actions e formulários client.
// Módulo "puro" (sem server-only) pra poder ser importado dos dois lados.

import type { MembershipRole, SystemRole } from "@/lib/supabase/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type EscalarInput = {
  eventId: string;
  teamId: string;
  positionId: string;
  requirementId: string | null;
  profileId: string;
};

export type CriarEventoInput = {
  title: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  location?: string;
  notes?: string;
  teamIds: string[]; // o admin só sinaliza QUAIS equipes; o líder define posições/quantidades
};

export type InviteTeamInput = {
  teamId: string;
  role: MembershipRole;
};

export type CriarConviteInput = {
  fullName: string;
  email: string;
  phone?: string;
  systemRole: SystemRole;
  teams: InviteTeamInput[];
};

export type AprovarProfileInput = {
  profileId: string;
  teams: InviteTeamInput[];
};
