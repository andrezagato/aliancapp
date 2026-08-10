"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DeliveryChannel } from "@/lib/supabase/database.types";

/**
 * ATRIBUIÇÃO DE CANAL NO CLIENTE (migration 0052).
 *
 * Os links de aviso chegam com `?via=push|whatsapp|email|in_app`, e a ideia
 * ingênua — ler `useSearchParams()` dentro do botão de responder — NÃO funciona
 * neste app. Duas coisas atropelam:
 *
 *  1. `EscalasView` faz `router.replace("/escalas")` pra tirar o modal da URL
 *     (decisão de 31/jul). O replace é hardcoded e leva a query embora.
 *  2. O modal da escala mora no layout e monta DEPOIS desse replace — quando o
 *     botão de responder existe, a URL já perdeu o `?via=` há muito tempo.
 *
 * Foi exatamente assim que o primeiro teste gravou `responded_via = null` com
 * status confirmado: a ação funcionou e a medição sumiu, calada.
 *
 * Então a captura acontece cedo, no layout (`RegistrarVia`), e o valor fica
 * guardado na sessão da aba. Quem lê usa `useVia()`.
 *
 * JANELA DE 30 MINUTOS, e ela é essencial: isto é um PWA, a aba sobrevive dias.
 * Sem expirar, quem entrou por um push no domingo apareceria como "veio do
 * push" ao confirmar outra escala na quinta — atribuição inflada é pior que
 * atribuição ausente, porque parece dado.
 */

const CANAIS: readonly string[] = ["push", "whatsapp", "email", "in_app"];
const CHAVE = "sirvo:via";
const JANELA_MS = 30 * 60_000;

function valido(v: string | null | undefined): DeliveryChannel | null {
  return v && CANAIS.includes(v) ? (v as DeliveryChannel) : null;
}

function guardar(canal: DeliveryChannel) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ canal, em: Date.now() }));
  } catch {
    /* storage bloqueado: fica sem atribuição, e está tudo bem */
  }
}

function ler(): DeliveryChannel | null {
  try {
    const cru = sessionStorage.getItem(CHAVE);
    if (!cru) return null;
    const { canal, em } = JSON.parse(cru) as { canal?: string; em?: number };
    const c = valido(canal);
    if (c && typeof em === "number" && Date.now() - em < JANELA_MS) return c;
    sessionStorage.removeItem(CHAVE);
    return null;
  } catch {
    return null;
  }
}

/**
 * Sem UI. Mora no layout do app pra rodar na primeira pintura de QUALQUER tela,
 * antes de qualquer `router.replace` conseguir apagar a query.
 */
export function RegistrarVia() {
  const sp = useSearchParams();
  const daUrl = valido(sp.get("via"));
  useEffect(() => {
    if (daUrl) guardar(daUrl);
  }, [daUrl]);
  return null;
}

/** De qual canal veio esta visita. Null = não deu pra saber (não invente). */
export function useVia(): DeliveryChannel | null {
  const sp = useSearchParams();
  const daUrl = valido(sp.get("via"));
  const [via, setVia] = useState<DeliveryChannel | null>(null);
  useEffect(() => {
    // A URL manda quando existe; senão vale o que a visita registrou na chegada.
    setVia(daUrl ?? ler());
  }, [daUrl]);
  return via;
}
