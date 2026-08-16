import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente de SERVICE-ROLE: ignora RLS e não tem `auth.uid()`.
 *
 * Nasceu pra cobrança agendada (migration 0045): o cron roda sem ninguém
 * logado, então nada do caminho normal serve. Depois virou também a ferramenta
 * do ONBOARDING PRÉ-LOGIN — conferir e-mail, achar convite por token, checar
 * pedido duplicado — porque quem ainda não entrou não tem `auth.uid()` e a RLS
 * de `invites`/`join_requests` só responde pra admin e líder.
 *
 * A regra não é "só cron": é que aqui NÃO EXISTE DONO. Toda checagem de
 * permissão que a RLS fazia de graça passa a ser responsabilidade de quem
 * chama — e quem chama tem que decidir, por escrito, o que fazer quando este
 * cliente é `null`. As duas respostas certas convivem no código de propósito:
 *   • `verificarEmailParaLink` LIBERA (fail-open): trancar a igreja inteira por
 *     causa de uma env ausente é pior que a conta órfã, que o líder destrava.
 *   • `/auth/entrar/[token]` FECHA (fail-closed): é a rota que abre sessão sem
 *     senha; sem conferir o convite ela aceitaria qualquer token chutado.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
