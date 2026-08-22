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
 * 2. NUNCA É AGUARDADA POR QUEM CHAMA — use `void registrarFalha(...)`. Gravar
 *    não pode atrasar a resposta de um login que já está com problema. A pessoa
 *    está esperando na tela.
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
    await admin.from("failure_log").insert({
      kind: input.kind,
      // O banco recusa `detail` nulo de propósito: registro sem motivo é ruído
      // com carimbo de data. Se não há mensagem, ao menos diga isso.
      detail: (input.detail || "(sem mensagem)").slice(0, 2000),
      subject: input.subject?.trim().toLowerCase() || null,
      origem: input.origem ?? null,
    });
  } catch {
    /* surdo de propósito — ver regra 1 */
  }
}
