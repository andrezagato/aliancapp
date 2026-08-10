import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";
import type {
  DeliveryChannel,
  DeliveryOutcome,
  NotificationKind,
} from "@/lib/supabase/database.types";

/**
 * TELEMETRIA DE CANAL (migration 0052).
 *
 * Por que existe: o envio é best-effort em todo lugar — `sendPushToSubs` engole
 * erro num catch vazio, `sendEmail` desiste em silêncio se falta a chave, e o
 * `notificar` filtra a preferência DENTRO do banco. O resultado é que uma
 * pessoa sem inscrição de push, uma inscrição expirada e um push entregue e
 * ignorado eram, no banco, a mesma coisa: nada. Sem distinguir esses três, não
 * dá pra saber se o remédio é cadastro, suporte técnico ou respeitar quem
 * pediu silêncio.
 *
 * Escopo deliberado: só os avisos de ESCALA (`escalado`, `lembrete`). Chat,
 * conquista e cadastro não entram — não fazem parte da pergunta que motivou
 * isto ("a pessoa foi alcançada e respondeu?") e logar tudo só encheria a
 * tabela de linhas que ninguém vai ler.
 *
 * Regra de ouro daqui: telemetria NUNCA derruba o envio. Todo caminho é
 * try/catch mudo. Perder uma medição é irrelevante; perder um aviso de escala
 * significa alguém sem saber que está escalado no domingo.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** O contexto do aviso — o que já se sabe antes de tentar entregar. */
export type EntregaCtx = {
  profileId: string;
  kind: NotificationKind;
  eventId?: string | null;
  assignmentId?: string | null;
  teamId?: string | null;
};

export type Entrega = EntregaCtx & {
  channel: DeliveryChannel;
  outcome: DeliveryOutcome;
  providerId?: string | null;
  detail?: string | null;
};

/**
 * Marca curta do aparelho, pra rastrear um caso concreto ("o push da Ana falha
 * sempre no mesmo aparelho?") sem guardar o endpoint. O endpoint É a capacidade
 * de enviar push pra aquele aparelho, e `delivery_log` é lida por líderes — ao
 * contrário de `push_subscriptions`, que ninguém lê por política.
 */
export function marcaDoAparelho(endpoint: string): string {
  return createHash("sha1").update(endpoint).digest("hex").slice(0, 10);
}

/**
 * Anexa a origem no link do aviso. É o que permite atribuir a resposta ao canal
 * que a provocou — sem isso, "o WhatsApp trouxe resposta nova" e "o WhatsApp
 * canibalizou quem já respondia" são indistinguíveis.
 */
export function comVia(link: string | undefined, canal: DeliveryChannel): string | undefined {
  if (!link) return link;
  if (/[?&]via=/.test(link)) return link;
  return `${link}${link.includes("?") ? "&" : "?"}via=${canal}`;
}

/** Caminho com sessão (quem escalou está logado) — grava via RPC security definer. */
export async function registrarEntrega(e: Entrega): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("registrar_entrega", {
      p_profile: e.profileId,
      p_channel: e.channel,
      p_outcome: e.outcome,
      p_kind: e.kind,
      p_event: e.eventId ?? undefined,
      p_assignment: e.assignmentId ?? undefined,
      p_team: e.teamId ?? undefined,
      p_provider_id: e.providerId ?? undefined,
      p_detail: e.detail ?? undefined,
    });
  } catch {
    /* medir nunca atrapalha entregar */
  }
}

/** Caminho sem sessão (o cron da cobrança) — service-role escreve direto. */
export async function registrarEntregaAdmin(admin: Admin, e: Entrega): Promise<void> {
  try {
    await admin.from("delivery_log").insert({
      profile_id: e.profileId,
      channel: e.channel,
      outcome: e.outcome,
      kind: e.kind,
      event_id: e.eventId ?? null,
      assignment_id: e.assignmentId ?? null,
      team_id: e.teamId ?? null,
      provider_id: e.providerId ?? null,
      detail: e.detail ?? null,
    });
  } catch {
    /* medir nunca atrapalha entregar */
  }
}

/**
 * Traduz o resultado bruto de um envio de push no desfecho que interessa.
 *
 * A agregação é POR PESSOA, não por aparelho: quem tem celular e tablet
 * apareceria com o dobro de alcance, e o painel passaria a medir aparelhos em
 * vez de gente. Um aparelho que aceitou já significa "alcançada".
 */
export function desfechoDoPush(r: { entregues: number; falhas: number }): DeliveryOutcome {
  if (r.entregues > 0) return "enviado";
  if (r.falhas > 0) return "falhou";
  return "sem_destino";
}
