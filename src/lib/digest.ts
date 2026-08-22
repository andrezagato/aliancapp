import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { digestEmail, sendEmail } from "@/lib/email";
import { registrarFalha } from "@/lib/failure-log";

/**
 * O DIGEST DIÁRIO — as perguntas que hoje só são feitas quando alguém reclama.
 *
 * Cada bloco existe por causa de um incidente real de agosto/2026. Não é a lista
 * do que dá pra medir; é a lista do que já falhou.
 *
 * SERVICE-ROLE porque o cron roda sem ninguém logado — mesma razão da cobrança
 * (0045). E porque as perguntas atravessam a RLS de propósito: "quem está
 * travado no onboarding" é sobre gente que ainda não tem sessão.
 *
 * A REGRA DESTE ARQUIVO, e ela vale mais que qualquer bloco: **nunca dizer
 * "tudo certo" sem ter olhado.** Silêncio pode significar saúde; afirmação de
 * saúde não pode significar "não consegui perguntar". Toda query aqui é
 * conferida, e o que falhar VIRA BLOCO em vez de virar lista vazia.
 */

const DIAS_PEDIDO_PARADO = 2;
const DIAS_CONVITE_VENCENDO = 2;

/**
 * 26h, não 24. O cron da Vercel não dispara na hora exata (o plano Hobby tem
 * até ~59min de folga). Com janela de 24h ancorada em `now()`, uma execução
 * mais tarde que a anterior cria um buraco permanente: rodou 10:00 e depois
 * 10:50, e o que caiu entre 10:00 e 10:50 nunca aparece em digest nenhum — o
 * registro seria descartado de novo, que é o defeito que a 0055 existe pra
 * consertar. Sobreposição custa uma linha repetida; buraco custa o incidente.
 */
const JANELA_HORAS = 26;

/**
 * Teto de linhas lidas do `failure_log`. O PostgREST corta em 1000 por padrão
 * e NÃO avisa — `data` vem cheio e `error` vem null. Sem teto explícito, um bot
 * gerando ruído empurraria uma falha real pra fora do e-mail: ela não ficaria
 * sub-reportada, ela sumiria. Com teto e contagem, o digest sabe que foi
 * truncado e diz isso.
 */
const TETO_FALHAS = 500;
const TETO_LINHAS_POR_BLOCO = 25;
const DIAS_RETENCAO = 30;

export type Bloco = { titulo: string; linhas: string[] };
export type DigestResumo = {
  blocos: Bloco[];
  heartbeat: boolean;
  enviadoPara: string | null;
  enviado: boolean;
  /** Por que não saiu, quando não saiu. `null` quando saiu ou quando não devia. */
  falhaEnvio: string | null;
};

/**
 * Pra onde vai. `DIGEST_EMAIL` na Vercel manda; sem ela, cai no e-mail do admin
 * que pediu o digest.
 *
 * O fallback é literal e não "todos os admins" de propósito: os outros dois
 * admins não pediram isso, e transformar relatório de infraestrutura em e-mail
 * semanal pra quem não vai agir sobre ele é como se ensina gente a ignorar
 * e-mail do Sirvo.
 */
function destino(): string {
  return process.env.DIGEST_EMAIL?.trim() || "andrezagato@gmail.com";
}

const chave = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
const diasDesde = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/** Corta a lista e diz que cortou. Bloco de 10 mil linhas não é aviso, é DoS. */
function limitar(linhas: string[], teto = TETO_LINHAS_POR_BLOCO): string[] {
  if (linhas.length <= teto) return linhas;
  return [...linhas.slice(0, teto), `… e mais ${linhas.length - teto} (mostrando ${teto})`];
}

export async function montarDigest(): Promise<Bloco[]> {
  const admin = createAdminClient();
  if (!admin) {
    return [
      {
        titulo: "O digest não conseguiu rodar",
        linhas: ["SUPABASE_SERVICE_ROLE_KEY ausente — nenhuma verificação foi feita."],
      },
    ];
  }

  const desde = new Date(Date.now() - JANELA_HORAS * 3600_000).toISOString();
  const blocos: Bloco[] = [];

  /**
   * O que não deu pra perguntar. Isto é o coração da correção: antes, `error`
   * era descartado nas 5 queries, `data` vinha `null`, `?? []` virava lista
   * vazia, nenhum bloco era empilhado — e o e-mail de domingo afirmava
   * "Tudo certo ✅" sobre uma verificação que não aconteceu.
   *
   * Cobre inclusive o caso que o guard de `!admin` não pega: chave de
   * service-role ERRADA (rotacionada, colada com espaço) passa pelo guard e faz
   * as 5 queries falharem com 401.
   */
  const naoPerguntou: string[] = [];
  const usar = <T,>(
    r: { data: T[] | null; error: { message: string } | null },
    oQue: string,
  ): T[] => {
    if (r.error) {
      naoPerguntou.push(`${oQue}: ${r.error.message}`);
      return [];
    }
    return r.data ?? [];
  };

  const [rFalhas, rTotalFalhas, rAprovados, rConvites, rAtivos, rPedidos] = await Promise.all([
    admin
      .from("failure_log")
      .select("kind, detail, subject, origem, created_at")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(TETO_FALHAS),
    admin
      .from("failure_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde),
    // `.order()` em todas: `limitar()` corta o FIM da lista, então sem ordem
    // definida ele guardava 25 linhas arbitrárias — e o convite que vence
    // amanhã podia ser justamente o descartado. Mais velho primeiro, que é a
    // ordem em que estas coisas importam.
    admin
      .from("join_requests")
      .select("full_name, email, created_at")
      .eq("status", "aprovado")
      .order("created_at", { ascending: true }),
    admin
      .from("invites")
      .select("email, full_name, created_at, expires_at")
      .eq("status", "pendente")
      .order("expires_at", { ascending: true, nullsFirst: true }),
    admin.from("profiles").select("email").eq("status", "ativo"),
    admin
      .from("join_requests")
      .select("full_name, created_at")
      .eq("status", "pendente")
      .order("created_at", { ascending: true }),
  ]);

  const falhas = usar(rFalhas, "falhas das últimas horas");
  const aprovados = usar(rAprovados, "pedidos aprovados");
  const convites = usar(rConvites, "convites pendentes");
  const ativos = usar(rAtivos, "membros ativos");
  const pedidos = usar(rPedidos, "pedidos pendentes");
  if (rTotalFalhas.error) naoPerguntou.push(`contagem de falhas: ${rTotalFalhas.error.message}`);
  // NÃO caia pra `falhas.length` quando `count` vem nulo: isso concluiria
  // "total == lido" e desligaria a detecção de truncamento afirmando que não
  // truncou. É exatamente o `?? []` que este arquivo veio consertar, de novo.
  const totalFalhas = rTotalFalhas.count;
  if (totalFalhas == null && !rTotalFalhas.error) {
    naoPerguntou.push("não consegui contar as falhas — não sei dizer se li todas");
  }

  const jaEntrou = new Set(ativos.map((p) => chave(p.email)).filter(Boolean));
  const agora = Date.now();
  const conviteVivo = (c: { expires_at: string | null }) =>
    !!c.expires_at && new Date(c.expires_at).getTime() > agora;

  // ---------------------------------------------------------------------------
  // 1) Falhas registradas — o bloco que não existia em 21/08, quando a Verônica
  //    bateu duas vezes no mesmo erro e o app não guardou nada.
  // ---------------------------------------------------------------------------
  const linhasFalha = Object.entries(
    falhas.reduce<Record<string, { n: number; exemplo: string; quem: Set<string> }>>((acc, f) => {
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
    // Corta PRIMEIRO, avisa DEPOIS: o aviso ia no fim da lista e o `limitar()`
    // guarda o começo, então com muitos grupos o aviso de truncamento era
    // justamente a linha truncada.
    const linhas = limitar(linhasFalha);
    if (totalFalhas != null && totalFalhas > falhas.length) {
      linhas.push(
        `⚠ ${totalFalhas} falhas no período, mas só li as ${falhas.length} mais recentes — o agrupamento acima está incompleto.`,
      );
    }
    // O título diz a janela REAL. Num arquivo cuja regra é "não afirmar sem ter
    // olhado", cabeçalho anunciando período que o código não usa é a mesma
    // mentira em miniatura.
    blocos.push({ titulo: `Falhas nas últimas ${JANELA_HORAS}h`, linhas });
  }

  // ---------------------------------------------------------------------------
  // 2) Travados no onboarding — o caso do Tiago, invisível por 5 dias.
  //    "Não entrou" é ausência de perfil ATIVO, e convite sem prazo é morto.
  // ---------------------------------------------------------------------------
  const comConviteVivo = new Set(convites.filter(conviteVivo).map((c) => chave(c.email)));
  const travados: string[] = [];
  const vistos = new Set<string>();

  for (const j of aprovados) {
    const e = chave(j.email);
    if (!e || jaEntrou.has(e) || comConviteVivo.has(e) || vistos.has(e)) continue;
    vistos.add(e);
    travados.push(`${j.full_name} (${j.email}) — aprovado há ${diasDesde(j.created_at)} dia(s), sem convite ativo`);
  }
  for (const c of convites) {
    const e = chave(c.email);
    // `comConviteVivo` TAMBÉM aqui: a mesma pessoa pode ter duas linhas
    // `pendente` — uma vencida e uma viva. Sem esta checagem a vencida era
    // reportada como travada enquanto ela tinha link bom na mão. Já houve dois
    // convites simultâneos no banco (marinathomazi3@, 24/07).
    if (!e || conviteVivo(c) || jaEntrou.has(e) || comConviteVivo.has(e) || vistos.has(e)) continue;
    vistos.add(e);
    travados.push(`${c.full_name || c.email} — convite venceu, nunca entrou`);
  }
  if (travados.length > 0) {
    blocos.push({ titulo: "Aprovados que não entraram", linhas: limitar(travados) });
  }

  // ---------------------------------------------------------------------------
  // 3) Convite vencendo — o único bloco PREVENTIVO. Avisar no dia em que venceu
  //    é avisar tarde: o link vale 7 dias porque o culto é semanal.
  // ---------------------------------------------------------------------------
  const limite = agora + DIAS_CONVITE_VENCENDO * 86_400_000;
  const jaAvisado = new Set<string>();
  const vencendo = convites
    .filter((c) => {
      const e = chave(c.email);
      if (!conviteVivo(c) || jaEntrou.has(e) || jaAvisado.has(e)) return false;
      if (new Date(c.expires_at!).getTime() > limite) return false;
      // Dedupe por pessoa, igual ao bloco 2: dois convites vivos do mesmo
      // e-mail são UM aviso. O precedente é real (marinathomazi3@, 24/07).
      jaAvisado.add(e);
      return true;
    })
    .map((c) => `${c.full_name || c.email} — o link vence em menos de ${DIAS_CONVITE_VENCENDO} dias`);
  if (vencendo.length > 0) {
    blocos.push({ titulo: "Convites prestes a vencer", linhas: limitar(vencendo) });
  }

  // ---------------------------------------------------------------------------
  // 4) Fila parada. `join_requests` aceita INSERT anônimo, então este bloco é o
  //    mais fácil de inundar de fora — daí o teto.
  // ---------------------------------------------------------------------------
  const parados = pedidos
    .filter((p) => diasDesde(p.created_at) >= DIAS_PEDIDO_PARADO)
    .map((p) => `${p.full_name} — pediu entrada há ${diasDesde(p.created_at)} dia(s) e ninguém respondeu`);
  if (parados.length > 0) {
    blocos.push({ titulo: "Pedidos de entrada parados", linhas: limitar(parados) });
  }

  // Por último de propósito: se algo não pôde ser perguntado, isso emoldura tudo
  // que veio acima — os outros blocos passam a ser "o que deu pra ver", não "o
  // que existe".
  if (naoPerguntou.length > 0) {
    blocos.push({ titulo: "⚠ O digest não conseguiu perguntar tudo", linhas: limitar(naoPerguntou) });
  }

  return blocos;
}

/** Apaga registro velho. Sem isto a tabela cresce pra sempre e o teto acima
 *  passa a esconder coisa recente atrás de coisa antiga. */
async function podar(): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const corte = new Date(Date.now() - DIAS_RETENCAO * 86_400_000).toISOString();
  const { error } = await admin.from("failure_log").delete().lt("created_at", corte);
  // O erro aqui ia pro lixo — a mesma classe de bug do resto deste commit. Poda
  // quebrada é crescimento que o próprio vigia não enxerga.
  if (error) await registrarFalha({ kind: "cron", detail: `poda: ${error.message}`, origem: "/api/cron/digest" });
}

/**
 * Roda e (talvez) manda.
 *
 * `dry` computa e devolve sem enviar nem podar — é assim que se testa isto sem
 * encher a caixa de ninguém, mesmo padrão do `?dry=1` da cobrança.
 */
export async function rodarDigest(opts: { dry?: boolean; hoje?: Date } = {}): Promise<DigestResumo> {
  const hoje = opts.hoje ?? new Date();
  // Domingo em São Paulo, não em UTC: o cron roda de manhã cedo BRT, e usar
  // getUTCDay() faria o heartbeat cair no sábado em parte do ano.
  const diaSP = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(hoje);
  const heartbeat = diaSP === "Sun";

  // O HEARTBEAT É A ÚLTIMA COISA QUE PODE MORRER. Se `montarDigest` LANÇAR (não
  // "devolver error" — lançar: rede fora, DNS, TLS), antes disso a rota inteira
  // caía no catch e nenhum e-mail saía nem no domingo. Só que é justamente no
  // dia em que a coleta falha que a prova de vida importa mais. Aqui o tombo
  // vira bloco, e o domingo sai assim mesmo dizendo o que houve.
  let blocos: Bloco[];
  try {
    blocos = await montarDigest();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await registrarFalha({ kind: "cron", detail: `montarDigest: ${msg}`, origem: "/api/cron/digest" });
    blocos = [{ titulo: "⚠ O digest não conseguiu rodar", linhas: [msg] }];
  }

  // A REGRA: silêncio = saudável. Só que silêncio eterno é indistinguível de "o
  // digest morreu" — o bug da cobrança (0045) um nível acima. O domingo resolve
  // isso sendo o batimento: se um domingo não chegar nada, o problema é o vigia.
  const deveMandar = blocos.length > 0 || heartbeat;
  if (!deveMandar || opts.dry) {
    return { blocos, heartbeat, enviadoPara: null, enviado: false, falhaEnvio: null };
  }

  const para = destino();

  // O TRY VAI ATÉ AQUI, e não só até a coleta. `digestEmail` monta um
  // `Intl.DateTimeFormat` e `sendEmail` fala com a rede: se qualquer um dos
  // dois lançar, o domingo não sai — que é precisamente o que este try existe
  // pra impedir. "O heartbeat é a última coisa que pode morrer" só vale se ele
  // estiver dentro da guarda.
  let envio: { ok: true } | { ok: false; motivo: string };
  try {
    const msg = digestEmail({ blocos, heartbeat });
    envio = await sendEmail({ to: para, subject: msg.subject, html: msg.html });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    await registrarFalha({ kind: "cron", detail: `envio do digest: ${motivo}`, origem: "/api/cron/digest" });
    envio = { ok: false, motivo };
  }

  // Poda depois de mandar: se o envio falhar, os registros continuam lá pro dia
  // seguinte em vez de sumirem junto com o e-mail que não chegou.
  if (envio.ok) {
    try {
      await podar();
    } catch (e) {
      await registrarFalha({
        kind: "cron",
        detail: `poda: ${e instanceof Error ? e.message : String(e)}`,
        origem: "/api/cron/digest",
      });
    }
  }

  return {
    blocos,
    heartbeat,
    enviadoPara: envio.ok ? para : null,
    enviado: envio.ok,
    falhaEnvio: envio.ok ? null : envio.motivo,
  };
}
