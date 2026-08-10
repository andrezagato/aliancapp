import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DeliveryChannel } from "@/lib/supabase/database.types";

/**
 * Leitura do painel de canais (migration 0052). Três RPCs `security definer`,
 * porque nenhuma delas caberia na RLS do app: o alcance precisa varrer
 * `push_subscriptions` de OUTRAS pessoas, e a eficácia precisa agregar
 * `assignments` da igreja toda — coisas que um líder não lê por política.
 *
 * As três já checam permissão dentro do banco (admin ou líder) e recortam pela
 * igreja do chamador. Aqui em cima é só tradução de nome e de tipo.
 */

export type CanalLinha = {
  canal: DeliveryChannel;
  enviados: number;
  falhou: number;
  semDestino: number;
  desligado: number;
  respostas: number;
  horasMediana: number | null;
  compareceram: number;
};

export type PessoaAlcance = {
  profileId: string;
  nome: string;
  temPush: boolean;
  temTelefone: boolean;
  zapLiberado: boolean;
  /**
   * Está escalada em algum culto que ainda vai acontecer. É o que separa "falta
   * telefone no cadastro" (crônico, some no meio do ruído) de "vai faltar no
   * domingo e não sabe" (urgente, e resolve).
   */
  escaladoEmBreve: boolean;
};

export type CanaisResumo = {
  escalados: number;
  respondidos: number;
  pendentes: number;
  atribuidos: number;
  semAtribuicao: number;
  horasAteConfirmar: number | null;
  horasAteRecusar: number | null;
};

export type CanaisPanel = {
  dias: number;
  resumo: CanaisResumo | null;
  canais: CanalLinha[];
  pessoas: PessoaAlcance[];
};

/**
 * `numeric` e `bigint` podem chegar como string dependendo do caminho (PostgREST
 * preserva precisão em alguns tipos). Coagir aqui evita "8.3" + 1 = "8.31" na tela.
 */
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 10 dígitos = DDD + número. MESMO critério do `canais_alcance` no banco — se
 *  os dois divergirem, o painel e a home contam histórias diferentes. */
export function temTelefoneValido(phone: string | null | undefined): boolean {
  return (phone ?? "").replace(/\D/g, "").length >= 10;
}

/**
 * A pessoa está fora de todos os canais instantâneos? Curto-circuita no
 * telefone: quem tem número já é alcançável e nem precisa da consulta.
 */
export async function souInalcancavel(
  profileId: string,
  phone: string | null | undefined,
): Promise<boolean> {
  if (temTelefoneValido(phone)) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  return (count ?? 0) === 0;
}

/**
 * Quem tem escala em culto que ainda vem. Duas queries simples em vez de um
 * embed `events!inner(...)`: `assignments` tem FK pra `events` E pra a view
 * `v_assignment_history`, e embed ambíguo no PostgREST falha em runtime — não
 * na compilação. A RLS recorta sozinha (líder vê as próprias equipes, admin vê
 * tudo), o mesmo recorte que a `canais_alcance` aplica nas pessoas.
 */
async function quemEstaEscaladoEmBreve(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  try {
    const { data: eventos } = await supabase
      .from("events")
      .select("id")
      .gte("starts_at", new Date().toISOString())
      .is("archived_at", null);
    const ids = (eventos ?? []).map((e) => e.id);
    if (ids.length === 0) return new Set();
    const { data } = await supabase
      .from("assignments")
      .select("profile_id")
      .in("event_id", ids)
      // recusado e vaga_aberta não interessam: ninguém precisa ser avisado.
      .in("status", ["convidado", "confirmado", "presente"]);
    return new Set((data ?? []).map((a) => a.profile_id).filter((id): id is string => !!id));
  } catch {
    return new Set();
  }
}

export async function getCanaisPanel(dias = 90): Promise<CanaisPanel> {
  const supabase = await createClient();
  const [resumoRes, eficaciaRes, alcanceRes] = await Promise.all([
    supabase.rpc("canais_resumo", { p_dias: dias }),
    supabase.rpc("canais_eficacia", { p_dias: dias }),
    supabase.rpc("canais_alcance"),
  ]);

  const linhaResumo = Array.isArray(resumoRes.data) ? resumoRes.data[0] : resumoRes.data;
  const resumo: CanaisResumo | null = linhaResumo
    ? {
        escalados: num(linhaResumo.escalados),
        respondidos: num(linhaResumo.respondidos),
        pendentes: num(linhaResumo.pendentes),
        atribuidos: num(linhaResumo.atribuidos),
        semAtribuicao: num(linhaResumo.sem_atribuicao),
        horasAteConfirmar: numOuNulo(linhaResumo.horas_ate_confirmar),
        horasAteRecusar: numOuNulo(linhaResumo.horas_ate_recusar),
      }
    : null;

  const escaladosEmBreve = await quemEstaEscaladoEmBreve(supabase);

  const canais: CanalLinha[] = (eficaciaRes.data ?? []).map((r) => ({
    canal: r.canal,
    enviados: num(r.enviados),
    falhou: num(r.falhou),
    semDestino: num(r.sem_destino),
    desligado: num(r.desligado),
    respostas: num(r.respostas),
    horasMediana: numOuNulo(r.horas_mediana),
    compareceram: num(r.compareceram),
  }));

  const pessoas: PessoaAlcance[] = (alcanceRes.data ?? [])
    .map((p) => ({
      profileId: p.profile_id,
      nome: p.nome,
      temPush: p.tem_push,
      temTelefone: p.tem_telefone,
      zapLiberado: p.zap_liberado,
      escaladoEmBreve: escaladosEmBreve.has(p.profile_id),
    }))
    // Ordem = urgência: quem está escalado e inalcançável primeiro (dá pra ligar
    // hoje), depois quem tem menos canal, e o alfabeto só como desempate.
    .sort((a, b) => {
      const peso = (x: PessoaAlcance) => (x.temPush ? 1 : 0) + (x.temTelefone ? 1 : 0);
      const urgente = (x: PessoaAlcance) => (x.escaladoEmBreve && peso(x) === 0 ? 0 : 1);
      return (
        urgente(a) - urgente(b) ||
        peso(a) - peso(b) ||
        a.nome.localeCompare(b.nome, "pt-BR")
      );
    });

  return { dias, resumo, canais, pessoas };
}
