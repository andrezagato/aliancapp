import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente de SERVICE-ROLE: ignora RLS e não tem `auth.uid()`.
 *
 * Existe por causa da cobrança agendada (migration 0045): o cron roda sem
 * ninguém logado, então nada do caminho normal serve — as RPCs de aviso exigem
 * `is_active()` e um `auth.uid()`, e a RLS não deixaria ler a escala nem as subs
 * de push de outra pessoa.
 *
 * Só pode ser usado por rota de cron/webhook, NUNCA a partir de uma ação do
 * usuário: aqui não existe dono, então toda checagem de permissão que a RLS
 * fazia de graça passa a ser responsabilidade de quem chama.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
