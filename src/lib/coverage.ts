import type { AssignmentStatus, RequirementStatus } from "@/lib/supabase/database.types";

// Status de assignment que "ocupam" a vaga (alguém está escalado, mesmo que
// ainda não tenha confirmado). 'recusado' e 'vaga_aberta' NÃO ocupam.
export const OCCUPYING: AssignmentStatus[] = ["convidado", "confirmado", "presente"];
export const CONFIRMED: AssignmentStatus[] = ["confirmado", "presente"];

export function occupies(status: AssignmentStatus): boolean {
  return OCCUPYING.includes(status);
}

export type CoverageTone = "full" | "partial" | "empty";

export function coverageTone(needed: number, assigned: number): CoverageTone {
  if (needed <= 0) return "full";
  if (assigned >= needed) return "full";
  if (assigned > 0) return "partial";
  return "empty";
}

/**
 * Tom que reflete a PRONTIDÃO real do culto (não só se a vaga está ocupada):
 * verde só quando tudo que é necessário está CONFIRMADO; âmbar quando há gente
 * escalada mas ainda faltam confirmações; vermelho quando não há ninguém.
 * Quem não confirmou não "conta" como pronto — é isso que evita o líder ver
 * verde sem ninguém ter dito sim.
 */
export function confirmTone(needed: number, confirmed: number, assigned: number): CoverageTone {
  if (needed <= 0) return "full";
  if (confirmed >= needed) return "full";
  if (assigned > 0) return "partial";
  return "empty";
}

// ---- linhas cruas (subset das tabelas) que a agregação consome ----
export type ReqRow = {
  id: string;
  team_id: string;
  position_id: string;
  needed_count: number;
  status: RequirementStatus;
};

export type AssignRow = {
  id: string;
  team_id: string;
  position_id: string;
  profile_id: string | null;
  status: AssignmentStatus;
};

export type TeamCoverage = {
  teamId: string;
  needed: number; // soma dos needed_count (reqs 'needed')
  assigned: number; // ocupadas, limitado ao needed por posição
  confirmed: number; // ocupadas confirmadas/presentes
  tone: CoverageTone;
};

/**
 * Cobertura por equipe de um evento: para cada requisito 'needed', quantas das
 * needed_count vagas estão ocupadas. 'not_applicable' não entra no denominador.
 */
export function coverageByTeam(reqs: ReqRow[], assigns: AssignRow[]): Map<string, TeamCoverage> {
  const byTeam = new Map<string, TeamCoverage>();

  for (const req of reqs) {
    if (req.status !== "needed") continue;
    const posAssigns = assigns.filter(
      (a) => a.position_id === req.position_id && a.profile_id && occupies(a.status),
    );
    const occ = Math.min(posAssigns.length, req.needed_count);
    const conf = Math.min(
      posAssigns.filter((a) => CONFIRMED.includes(a.status)).length,
      req.needed_count,
    );

    const cur = byTeam.get(req.team_id) ?? {
      teamId: req.team_id,
      needed: 0,
      assigned: 0,
      confirmed: 0,
      tone: "empty" as CoverageTone,
    };
    cur.needed += req.needed_count;
    cur.assigned += occ;
    cur.confirmed += conf;
    byTeam.set(req.team_id, cur);
  }

  for (const cov of byTeam.values()) {
    cov.tone = coverageTone(cov.needed, cov.assigned);
  }
  return byTeam;
}

/** Rollup do evento inteiro (todas as equipes). */
export function coverageTotal(reqs: ReqRow[], assigns: AssignRow[]): TeamCoverage {
  const perTeam = coverageByTeam(reqs, assigns);
  const total = { teamId: "", needed: 0, assigned: 0, confirmed: 0, tone: "empty" as CoverageTone };
  for (const c of perTeam.values()) {
    total.needed += c.needed;
    total.assigned += c.assigned;
    total.confirmed += c.confirmed;
  }
  total.tone = coverageTone(total.needed, total.assigned);
  return total;
}
