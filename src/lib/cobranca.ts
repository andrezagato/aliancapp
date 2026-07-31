import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUserAsAdmin } from "@/lib/push";
import { sendEmail, lembreteEmail, siteUrl } from "@/lib/email";
import { fmtEventWhen } from "@/lib/format";

/**
 * COBRANÇA DE ESCALA (migration 0045) — a única tarefa agendada do Sirvo.
 *
 * O problema: hoje quem é escalado recebe UM aviso, na hora da escalação, e
 * nunca mais. Quem ignorou aquele push chega no domingo sem ter respondido, e o
 * líder só descobre se abrir o app e olhar o card de pendências.
 *
 * A regra (combinada com o André em 31/jul):
 *  - Volunteer que não respondeu é cobrado em ESCALADA — D-3, D-2, D-1 e no dia
 *    do culto — com o tom subindo a cada degrau, e PARA na primeira resposta,
 *    seja "vou" ou "não posso" (a recusa é ótima: libera a vaga a tempo).
 *  - Líder da equipe e responsável do culto recebem um resumo diário de quem
 *    está pendente, porque são os únicos que podem AGIR.
 *  - Diário achatado ensinaria a ignorar (e existe um interruptor no perfil):
 *    escalada tem significado, repetição igual vira paisagem.
 *
 * Por que roda ao meio-dia: o plano Hobby da Vercel dá UM disparo por dia. Como
 * 5 dos cultos da Aliança são domingo 8h, um cron noturno nunca alcançaria o
 * "dia do evento" deles. Ao meio-dia, culto de noite recebe a cobrança "é hoje"
 * e culto de manhã recebe três cobranças, a última na véspera ("amanhã às 8h").
 */

const TZ = "America/Sao_Paulo";
/** Degraus de cobrança, em dias de calendário até o culto. */
const STEPS = [3, 2, 1, 0] as const;
/** Antes disso, "hoje ao meio-dia" já é tarde — a véspera cobriu. */
const MIN_HORA_PARA_COBRAR_NO_DIA = 14;

type Step = (typeof STEPS)[number];

/** Data local (YYYY-MM-DD) em São Paulo — o "dia" que a igreja vive. */
function diaLocal(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function horaLocal(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d),
  );
}

function hhmmLocal(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Dias de CALENDÁRIO entre hoje e o evento (0 = hoje, 1 = amanhã). */
function diasAte(agora: Date, evento: Date): number {
  const a = new Date(`${diaLocal(agora)}T00:00:00Z`).getTime();
  const b = new Date(`${diaLocal(evento)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** O tom sobe a cada degrau — é isso que diferencia cobrança de barulho. */
function textoCobranca(step: Step, titulo: string, hora: string, quando: string) {
  switch (step) {
    case 3:
      return {
        title: "Confirma sua presença?",
        body: `Você foi escalado em ${titulo} (${quando}) e ainda não respondeu.`,
      };
    case 2:
      return {
        title: "Faltam 2 dias · confirma?",
        body: `${titulo} (${quando}). Sua resposta ajuda a equipe a se organizar.`,
      };
    case 1:
      return {
        title: "É amanhã! Você confirma?",
        body: `${titulo}, amanhã às ${hora}. Ainda sem sua resposta.`,
      };
    case 0:
      return {
        title: `É hoje às ${hora}!`,
        body: `${titulo} é hoje e você ainda não confirmou. Dá um alô?`,
      };
  }
}

export type CobrancaResumo = {
  dry: boolean;
  rodadaEm: string;
  eventos: {
    id: string;
    titulo: string;
    quando: string;
    diasAte: number;
    pendentes: number;
    trocasAbertas?: number;
    cobrados: string[];
    gestoresAvisados: string[];
    pulado?: string;
  }[];
  totalCobrancas: number;
  totalDigests: number;
};

/**
 * Roda uma passada da cobrança. `dry` computa e devolve o que FARIA, sem enviar
 * nem gravar — é o único jeito honesto de testar isto sem cobrar gente real.
 */
export async function rodarCobranca({ dry = false }: { dry?: boolean } = {}): Promise<CobrancaResumo> {
  const admin = createAdminClient();
  const agora = new Date();
  const resumo: CobrancaResumo = {
    dry,
    rodadaEm: agora.toISOString(),
    eventos: [],
    totalCobrancas: 0,
    totalDigests: 0,
  };
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente — cobrança não pode rodar.");

  // Janela: do agora até 4 dias à frente (o degrau mais distante é D-3).
  const limite = new Date(agora.getTime() + 5 * 86_400_000).toISOString();
  const { data: eventos, error } = await admin
    .from("events")
    .select("id, title, starts_at, responsible_id")
    .gte("starts_at", agora.toISOString())
    .lte("starts_at", limite)
    .is("archived_at", null) // culto arquivado não cobra ninguém
    .order("starts_at");
  if (error) throw new Error(error.message);

  for (const ev of eventos ?? []) {
    const inicio = new Date(ev.starts_at);
    const dias = diasAte(agora, inicio);
    const titulo = ev.title || "um culto";
    const quando = fmtEventWhen(ev.starts_at);
    const linha: CobrancaResumo["eventos"][number] = {
      id: ev.id,
      titulo,
      quando,
      diasAte: dias,
      pendentes: 0,
      cobrados: [],
      gestoresAvisados: [],
    };

    if (!STEPS.includes(dias as Step)) {
      linha.pulado = `fora dos degraus (faltam ${dias} dias)`;
      resumo.eventos.push(linha);
      continue;
    }
    const step = dias as Step;
    if (step === 0 && horaLocal(inicio) < MIN_HORA_PARA_COBRAR_NO_DIA) {
      linha.pulado = `culto de manhã (${hhmmLocal(inicio)}) — a cobrança da véspera já avisou`;
      resumo.eventos.push(linha);
      continue;
    }

    // Quem ainda não respondeu.
    const { data: pendentes } = await admin
      .from("assignments")
      .select("id, profile_id, team_id, profiles!assignments_profile_id_fkey ( full_name, nickname, email )")
      .eq("event_id", ev.id)
      .eq("status", "convidado");

    // Quem já pediu troca NÃO é cobrado: a pessoa avisou que não pode e a bola
    // está com o líder. Cobrar "confirma sua presença" aqui é o app não ter
    // ouvido a resposta que já recebeu. Mas a troca também não pode sumir do
    // radar — ela vai pro resumo do gestor, porque é ELE que precisa decidir.
    const idsDoEvento = (pendentes ?? []).map((a) => a.id);
    const { data: trocas } = idsDoEvento.length
      ? await admin
          .from("swap_requests")
          .select(
            "assignment_id, substitute_accepted_at, requester:profiles!swap_requests_requested_by_fkey ( full_name, nickname ), sugerido:profiles!swap_requests_suggested_profile_id_fkey ( full_name, nickname )",
          )
          .eq("status", "pendente")
          .in("assignment_id", idsDoEvento)
      : { data: [] as never[] };
    const bloqueados = new Set((trocas ?? []).map((t) => t.assignment_id));
    const alvos = (pendentes ?? []).filter((a) => a.profile_id && !bloqueados.has(a.id));
    linha.pendentes = alvos.length;
    linha.trocasAbertas = (trocas ?? []).length;
    if (alvos.length === 0 && (trocas ?? []).length === 0) {
      resumo.eventos.push(linha);
      continue;
    }

    const hora = hhmmLocal(inicio);
    const texto = textoCobranca(step, titulo, hora, quando);
    const link = `/escalas/${ev.id}`;

    for (const a of alvos) {
      const profileId = a.profile_id as string;
      const pessoa = a.profiles as { full_name: string | null; nickname: string | null; email: string | null } | null;
      const nome = pessoa?.nickname || pessoa?.full_name || "Alguém";

      // O travamento: grava PRIMEIRO. Se a linha já existia, não envia de novo —
      // é o que torna um re-run do cron inofensivo.
      if (!dry) {
        const { data: gravou } = await admin
          .from("reminder_log")
          .upsert(
            { kind: "escala_pendente", event_id: ev.id, profile_id: profileId, step },
            { onConflict: "kind,event_id,profile_id,step", ignoreDuplicates: true },
          )
          .select("id");
        if (!gravou || gravou.length === 0) continue; // já cobrado neste degrau
      }

      linha.cobrados.push(nome);
      resumo.totalCobrancas++;
      if (dry) continue;

      const prefs = await lerPrefs(admin, profileId, "lembrete");
      if (prefs.in_app) {
        await admin.from("notifications").insert({
          recipient_id: profileId,
          kind: "lembrete",
          title: texto.title,
          body: texto.body,
          link,
          event_id: ev.id,
          team_id: a.team_id,
        });
      }
      if (prefs.push) {
        await sendPushToUserAsAdmin(admin, profileId, {
          title: texto.title,
          body: texto.body,
          url: link,
          // o toque abre a ESCALA do culto: a pessoa vê com quem vai servir e em
          // que posição antes de aceitar — decidido assim com o André, e o botão
          // dentro da notificação não existiria no iPhone de qualquer jeito
          tag: `escala-${a.id}`,
        });
      }
      // E-mail só na véspera: é o degrau em que ainda dá pra remanejar, e evita
      // encher a caixa (e o limite diário do Resend) nos outros dias.
      if (step === 1 && prefs.email && pessoa?.email) {
        try {
          const em = lembreteEmail({ evento: titulo, quando, href: `${siteUrl()}${link}` });
          await sendEmail({ to: pessoa.email, subject: em.subject, html: em.html });
        } catch {
          /* best-effort */
        }
      }
    }

    // ---- Resumo pro líder e pro responsável -------------------------------
    // Só quem pode AGIR, e só se sobrou pendência. Um por dia (o degrau muda).
    const nomesPendentes = alvos
      .map((a) => {
        const p = a.profiles as { full_name: string | null; nickname: string | null } | null;
        return p?.nickname || p?.full_name || "alguém";
      })
      .join(", ");
    // Troca aberta é decisão do gestor: entra no resumo com o estado real ("já
    // aceitou, falta você aprovar" vs "ainda esperando o substituto").
    const trocasTexto = (trocas ?? [])
      .map((t) => {
        const req = t.requester as { full_name: string | null; nickname: string | null } | null;
        const sug = t.sugerido as { full_name: string | null; nickname: string | null } | null;
        const quem = req?.nickname || req?.full_name || "alguém";
        const sub = sug?.nickname || sug?.full_name || null;
        if (!sub) return `${quem} pediu troca sem substituto`;
        return t.substitute_accepted_at
          ? `${quem} → ${sub} (aceitou, falta você aprovar)`
          : `${quem} → ${sub} (aguardando ${sub})`;
      })
      .join("; ");
    const teamIdsPendentes = alvos.map((a) => a.team_id);
    const teamIdsTroca = (pendentes ?? [])
      .filter((a) => bloqueados.has(a.id))
      .map((a) => a.team_id);
    const teamIds = [...new Set([...teamIdsPendentes, ...teamIdsTroca].filter(Boolean) as string[])];
    const { data: lideres } = teamIds.length
      ? await admin.from("memberships").select("profile_id").in("team_id", teamIds).eq("role", "leader")
      : { data: [] as { profile_id: string }[] };
    const gestores = [
      ...new Set([...(lideres ?? []).map((l) => l.profile_id), ev.responsible_id].filter(Boolean) as string[]),
    ];

    for (const gestorId of gestores) {
      if (!dry) {
        const { data: gravou } = await admin
          .from("reminder_log")
          .upsert(
            { kind: "digest_gestor", event_id: ev.id, profile_id: gestorId, step },
            { onConflict: "kind,event_id,profile_id,step", ignoreDuplicates: true },
          )
          .select("id");
        if (!gravou || gravou.length === 0) continue;
      }
      linha.gestoresAvisados.push(gestorId);
      resumo.totalDigests++;
      if (dry) continue;

      const quantos = alvos.length;
      const quantasTrocas = (trocas ?? []).length;
      const prefixo = step === 0 ? "Hoje" : step === 1 ? "Amanhã" : null;
      const assunto =
        quantos > 0 && quantasTrocas > 0
          ? `${quantos} sem resposta e ${quantasTrocas} troca${quantasTrocas > 1 ? "s" : ""} pra decidir`
          : quantos > 0
            ? `${quantos} sem resposta`
            : `${quantasTrocas} troca${quantasTrocas > 1 ? "s" : ""} esperando você`;
      const title = prefixo ? `${prefixo}: ${assunto}` : assunto;
      const partes = [`${titulo} (${quando})`];
      if (quantos > 0) partes.push(`sem resposta: ${nomesPendentes}`);
      if (quantasTrocas > 0) partes.push(`troca: ${trocasTexto}`);
      const body = `${partes.join(" · ")}.`;
      const prefs = await lerPrefs(admin, gestorId, "cobertura");
      if (prefs.in_app) {
        await admin.from("notifications").insert({
          recipient_id: gestorId,
          kind: "cobertura",
          title,
          body,
          link,
          event_id: ev.id,
        });
      }
      if (prefs.push) {
        await sendPushToUserAsAdmin(admin, gestorId, {
          title,
          body,
          url: link,
          tag: `pendentes-${ev.id}`,
        });
      }
    }

    resumo.eventos.push(linha);
  }

  return resumo;
}

/** Preferência do destinatário (a tabela tem default ligado; linha ausente = sim). */
async function lerPrefs(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  kind: "lembrete" | "cobertura",
): Promise<{ push: boolean; email: boolean; in_app: boolean }> {
  const { data } = await admin
    .from("notification_prefs")
    .select("push, email, in_app")
    .eq("profile_id", profileId)
    .eq("kind", kind)
    .maybeSingle();
  return {
    push: data?.push ?? true,
    email: data?.email ?? true,
    in_app: data?.in_app ?? true,
  };
}
