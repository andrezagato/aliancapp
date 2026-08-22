import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { digestEmail, sendEmail } from "@/lib/email";

/**
 * O DIGEST DIÁRIO — as perguntas que hoje só são feitas quando alguém reclama.
 *
 * Cada bloco daqui existe por causa de um incidente real de agosto/2026. Não é
 * uma lista de tudo que dá pra medir; é a lista do que já falhou.
 *
 * SERVICE-ROLE porque o cron roda sem ninguém logado — mesma razão da cobrança
 * (0045). E porque as perguntas atravessam a RLS de propósito: "quem está
 * travado no onboarding" é justamente sobre gente que ainda não tem sessão.
 */

const DIAS_PEDIDO_PARADO = 2;
const DIAS_CONVITE_VENCENDO = 2;

export type Bloco = { titulo: string; linhas: string[] };
export type DigestResumo = {
  blocos: Bloco[];
  heartbeat: boolean;
  enviadoPara: string | null;
  enviado: boolean;
};

/**
 * Pra onde vai. `DIGEST_EMAIL` na Vercel manda; sem ela, cai no e-mail do admin
 * que pediu o digest.
 *
 * O fallback é literal e não "todos os admins" de propósito: os outros dois
 * admins não pediram isso, e transformar um relatório de infraestrutura em
 * e-mail semanal pra quem não vai agir sobre ele é como se ensina gente a
 * ignorar e-mail do Sirvo.
 */
function destino(): string {
  return process.env.DIGEST_EMAIL?.trim() || "andrezagato@gmail.com";
}

const chave = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/**
 * Monta os blocos. Bloco sem linha NÃO entra — é o que faz "nada a dizer"
 * chegar como zero blocos, e o cron decidir não mandar nada.
 */
export async function montarDigest(): Promise<Bloco[]> {
  const admin = createAdminClient();
  if (!admin) {
    // Sem service-role o digest não consegue perguntar nada. Dizer isso é
    // melhor que mandar "tudo certo" sem ter olhado — que seria o mesmo
    // silêncio mentiroso que estamos combatendo.
    return [
      {
        titulo: "O digest não conseguiu rodar",
        linhas: ["SUPABASE_SERVICE_ROLE_KEY ausente — nenhuma verificação foi feita."],
      },
    ];
  }

  const desde24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [{ data: falhas }, { data: aprovados }, { data: convites }, { data: ativos }, { data: pedidos }] =
    await Promise.all([
      admin
        .from("failure_log")
        .select("kind, detail, subject, origem, created_at")
        .gte("created_at", desde24h)
        .order("created_at", { ascending: false }),
      admin.from("join_requests").select("full_name, email, created_at").eq("status", "aprovado"),
      admin.from("invites").select("email, full_name, created_at, expires_at").eq("status", "pendente"),
      admin.from("profiles").select("email").eq("status", "ativo"),
      admin.from("join_requests").select("full_name, created_at").eq("status", "pendente"),
    ]);

  const blocos: Bloco[] = [];
  const jaEntrou = new Set((ativos ?? []).map((p) => chave(p.email)).filter(Boolean));
  const agora = Date.now();
  const conviteVivo = (c: { expires_at: string | null }) =>
    !!c.expires_at && new Date(c.expires_at).getTime() > agora;

  // -------------------------------------------------------------------------
  // 1) Falhas registradas — o bloco que não existia em 21/08, quando a Verônica
  //    bateu duas vezes no mesmo erro e o app não guardou nada.
  // -------------------------------------------------------------------------
  const linhasFalha = Object.entries(
    (falhas ?? []).reduce<Record<string, { n: number; exemplo: string; quem: Set<string> }>>((acc, f) => {
      const k = `${f.kind} · ${f.origem ?? "sem origem"}`;
      acc[k] ??= { n: 0, exemplo: f.detail, quem: new Set() };
      acc[k].n += 1;
      if (f.subject) acc[k].quem.add(f.subject);
      return acc;
    }, {}),
  ).map(([k, v]) => {
    const quem = v.quem.size > 0 ? ` — ${[...v.quem].slice(0, 3).join(", ")}` : "";
    // A mensagem CRUA vai junto: foi o literal do GoTrue que apontou o PKCE.
    return `${v.n}× ${k}${quem} · "${v.exemplo.slice(0, 140)}"`;
  });
  if (linhasFalha.length > 0) {
    blocos.push({ titulo: "Falhas nas últimas 24h", linhas: linhasFalha });
  }

  // -------------------------------------------------------------------------
  // 2) Travados no onboarding — o caso do Tiago, invisível por 5 dias.
  //    Mesma regra da tela (listStuckEntries): "não entrou" é ausência de
  //    perfil ATIVO, e convite sem prazo conta como morto.
  // -------------------------------------------------------------------------
  const comConviteVivo = new Set((convites ?? []).filter(conviteVivo).map((c) => chave(c.email)));
  const travados: string[] = [];
  const vistos = new Set<string>();

  for (const j of aprovados ?? []) {
    const e = chave(j.email);
    if (!e || jaEntrou.has(e) || comConviteVivo.has(e) || vistos.has(e)) continue;
    vistos.add(e);
    travados.push(`${j.full_name} (${j.email}) — aprovado há ${diasDesde(j.created_at)} dia(s), sem convite ativo`);
  }
  for (const c of convites ?? []) {
    const e = chave(c.email);
    if (!e || conviteVivo(c) || jaEntrou.has(e) || vistos.has(e)) continue;
    vistos.add(e);
    travados.push(`${c.full_name || c.email} — convite venceu, nunca entrou`);
  }
  if (travados.length > 0) {
    blocos.push({ titulo: "Aprovados que não entraram", linhas: travados });
  }

  // -------------------------------------------------------------------------
  // 3) Convite vencendo — o único bloco PREVENTIVO. Avisar no dia em que venceu
  //    é avisar tarde: o link vale 7 dias porque o culto é semanal, então quem
  //    perde o prazo perde um domingo.
  // -------------------------------------------------------------------------
  const limite = agora + DIAS_CONVITE_VENCENDO * 86_400_000;
  const vencendo = (convites ?? [])
    .filter((c) => conviteVivo(c) && new Date(c.expires_at!).getTime() <= limite && !jaEntrou.has(chave(c.email)))
    .map((c) => `${c.full_name || c.email} — o link vence em menos de ${DIAS_CONVITE_VENCENDO} dias`);
  if (vencendo.length > 0) {
    blocos.push({ titulo: "Convites prestes a vencer", linhas: vencendo });
  }

  // -------------------------------------------------------------------------
  // 4) Fila parada. A fila de aprovação já aparece na home, mas some no meio da
  //    rotina — e "alguém pediu entrada e ninguém respondeu" foi o começo da
  //    história do Tiago.
  // -------------------------------------------------------------------------
  const parados = (pedidos ?? [])
    .filter((p) => diasDesde(p.created_at) >= DIAS_PEDIDO_PARADO)
    .map((p) => `${p.full_name} — pediu entrada há ${diasDesde(p.created_at)} dia(s) e ninguém respondeu`);
  if (parados.length > 0) {
    blocos.push({ titulo: "Pedidos de entrada parados", linhas: parados });
  }

  return blocos;
}

/**
 * Roda e (talvez) manda.
 *
 * `dry` computa e devolve sem enviar — é assim que se testa isto sem encher a
 * caixa de ninguém, mesmo padrão do `?dry=1` da cobrança.
 */
export async function rodarDigest(opts: { dry?: boolean; hoje?: Date } = {}): Promise<DigestResumo> {
  const hoje = opts.hoje ?? new Date();
  // Domingo em São Paulo, não em UTC: o cron roda de manhã cedo BRT, e usar
  // getUTCDay() faria o heartbeat cair no sábado em parte do ano.
  const diaSP = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(hoje);
  const heartbeat = diaSP === "Sun";

  const blocos = await montarDigest();

  // A REGRA: silêncio = saudável. Só que silêncio eterno é indistinguível de
  // "o digest morreu" — que é exatamente o bug da cobrança (0045), que passou 3
  // dias sem rodar sem ninguém notar. O domingo resolve isso sendo o batimento:
  // se um domingo não chegar nada, o problema é o próprio digest.
  const deveMandar = blocos.length > 0 || heartbeat;
  if (!deveMandar || opts.dry) {
    return { blocos, heartbeat, enviadoPara: null, enviado: false };
  }

  const para = destino();
  const msg = digestEmail({ blocos, heartbeat });
  await sendEmail({ to: para, subject: msg.subject, html: msg.html });
  return { blocos, heartbeat, enviadoPara: para, enviado: true };
}
