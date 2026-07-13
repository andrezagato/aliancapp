import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRole, Profile } from "@/lib/supabase/database.types";

export type SessionTeam = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  role: MembershipRole;
};

export type SessionProfile = Profile & {
  teams: SessionTeam[];
};

export type EffectiveRole = "admin" | "leader" | "volunteer";

export type Session = {
  userId: string;
  email: string | null;
  profile: SessionProfile;
  role: EffectiveRole;
};

/**
 * Carrega o usuário logado + profile + equipes (memberships) numa tacada.
 * Memoizado por request (React cache) — pode ser chamado em vários componentes
 * sem repetir a query. Retorna null se não houver sessão ou profile.
 */
export const getAuthUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
});

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `*,
       memberships (
         role,
         team:teams ( id, name, color, icon, sort_order, archived_at )
       )`,
    )
    .eq("id", user.id)
    .maybeSingle();

  // Usuário logado mas profile ainda não existe (corrida com o trigger de
  // onboarding) — devolve um profile PENDENTE sintético pra cair na fila de
  // aprovação sem loop de redirect.
  if (error || !data) {
    const pending: SessionProfile = {
      id: user.id,
      church_id: null,
      full_name: (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? "",
      email: user.email ?? null,
      phone: null,
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      birth_date: null,
      system_role: "member",
      status: "pendente",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      teams: [],
    };
    return { userId: user.id, email: user.email ?? null, profile: pending, role: "volunteer" };
  }

  const { memberships, ...profile } = data as Profile & {
    memberships: {
      role: MembershipRole;
      team: {
        id: string;
        name: string;
        color: string;
        icon: string;
        sort_order: number;
        archived_at: string | null;
      } | null;
    }[];
  };

  const teams: SessionTeam[] = (memberships ?? [])
    .filter((m) => m.team && !m.team.archived_at)
    .map((m) => ({
      id: m.team!.id,
      name: m.team!.name,
      color: m.team!.color,
      icon: m.team!.icon,
      sort_order: m.team!.sort_order,
      role: m.role,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const sessionProfile: SessionProfile = { ...(profile as Profile), teams };

  return {
    userId: user.id,
    email: user.email ?? profile.email ?? null,
    profile: sessionProfile,
    role: effectiveRole(sessionProfile),
  };
});

export function effectiveRole(profile: SessionProfile): EffectiveRole {
  if (profile.system_role === "admin") return "admin";
  if (profile.teams.some((t) => t.role === "leader")) return "leader";
  return "volunteer";
}

/** Ativo = já provisionado numa igreja (não está na fila de aprovação). */
export function isActive(profile: Pick<Profile, "status" | "church_id">): boolean {
  return profile.status === "ativo" && !!profile.church_id;
}

export function leadTeamIds(profile: SessionProfile): string[] {
  return profile.teams.filter((t) => t.role === "leader").map((t) => t.id);
}

export function memberTeamIds(profile: SessionProfile): string[] {
  return profile.teams.map((t) => t.id);
}

export function isLeaderOf(profile: SessionProfile, teamId: string): boolean {
  return profile.teams.some((t) => t.id === teamId && t.role === "leader");
}

/** Pode editar a escala desta equipe? (admin ou líder dela) */
export function canManageTeam(session: Session, teamId: string): boolean {
  return session.role === "admin" || isLeaderOf(session.profile, teamId);
}
