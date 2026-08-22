import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O GRAVADOR DE FALHAS (migration 0055).
 *
 * Chame nos lugares onde o sistema JÁ SABE que algo deu errado e hoje descarta:
 * o catch do e-mail, o `verifyOtp` que recusou, o redirect de erro do login.
 * Não detecta nada novo — só para de jogar fora.
 *
 * TRÊS REGRAS, e as três existem por causa de um incidente real:
 *
 * 1. NUNCA LANÇA. Ela observa caminhos que já estão dando errado; se explodisse,
 *    transformaria "o e-mail não saiu" em "a escalação quebrou". O `catch` vazio
 *    no fim é a única coisa aqui que é intencionalmente surda.
 *
 * 2. SEMPRE AGUARDADA POR QUEM CHAMA — `await registrarFalha(...)`.
 *
 *    Esta regra já foi o contrário, e estava errada. `void` numa função da
 *    Vercel entrega a resposta e a instância pode ser CONGELADA na hora: o
 *    insert em voo é cancelado. Pior que perder sempre — o Fluid compute reusa
 *    instância quente, então sob tráfego o registro chega, e **sob tráfego baixo
 *    ele some**. Uma igreja de 51 pessoas num sábado à noite é tráfego baixo:
 *    o gravador perderia justamente o PRIMEIRO evento de cada incidente, que é
 *    o único que importa. Perda não-determinística é muito mais difícil de
 *    notar que perda total — o teste passa e a produção mente.
 *
 *    O medo que justificava o `void` (atrasar quem espera na tela) não
 *    sobrevive à conta: o banco responde em 25-70ms, num caminho que acabou de
 *    fazer round-trip no GoTrue e vai emitir um redirect que o navegador ainda
 *    precisa seguir. Se um dia isso incomodar, o jeito certo é `after()` do
 *    `next/server` — que existe exatamente pra estender a vida da invocação —,
 *    nunca voltar pro `void`.
 *
 * 3. GRAVA A MENSAGEM CRUA. Traduzir aqui destrói o valor: foi o literal
 *    "both auth code and code verifier should be non-empty" que apontou o PKCE.
 *    "Não consegui entrar" não teria apontado nada. Quem traduz pra humano é o
 *    digest, na hora de escrever o e-mail — e ele ainda mostra o cru embaixo.
 *
 * Sem `SUPABASE_SERVICE_ROLE_KEY` isto vira no-op silencioso, igual ao
 * `sendEmail` sem chave. É o único jeito honesto: um gravador de falhas que
 * derruba a build por falta de env seria a pior ironia possível.
 */
export type FalhaKind = "login_link" | "convite_link" | "email" | "cron";

export async function registrarFalha(input: {
  kind: FalhaKind;
  /** A mensagem crua do serviço. Não traduza. */
  detail: string;
  /** De quem é a falha (e-mail), quando se sabe. */
  subject?: string | null;
  /** Onde aconteceu — separa /auth/confirm de /auth/callback sem parsear o detail. */
  origem?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    // O RESULTADO DESTE INSERT É LIDO. O postgrest-js não lança quando o banco
    // recusa — devolve `{error}` —, então sem destruturar, um registro rejeitado
    // (RLS, constraint, tabela fora) sumia sem o `catch` nunca ver. O gravador
    // de falhas silenciosas falhando em silêncio é a piada que este arquivo não
    // pode ser. Console, não `registrarFalha`: chamar a si mesmo aqui é laço.
    const { error } = await admin.from("failure_log").insert({
      kind: input.kind,
      // O banco recusa `detail` nulo de propósito: registro sem motivo é ruído
      // com carimbo de data. Se não há mensagem, ao menos diga isso.
      detail: (input.detail || "(sem mensagem)").slice(0, 2000),
      subject: input.subject?.trim().toLowerCase() || null,
      origem: input.origem ?? null,
    });
    if (error) console.error("[failure-log] o banco recusou o registro:", error.message);
  } catch {
    /* surdo de propósito — ver regra 1 */
  }
}
