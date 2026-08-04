"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * AO VIVO PRA TODO MUNDO (migration 0047) — a sincronia do roteiro, num lugar só.
 *
 * Antes, quem marcava um bloco via a mudança na hora e o resto da equipe só
 * depois de puxar a tela — no meio do culto, quando ninguém tem mão livre. Isto
 * escuta as mudanças do roteiro do evento e manda o servidor renderizar de novo.
 *
 * Vive fora dos componentes porque a régia precisa disto MAIS que o celular: a
 * tela da sala de controle fica horas aberta e ninguém vai lembrar de recarregar.
 *
 * `ocupado` é a válvula: quem espelha `items` em estado local (o grid do celular,
 * com arraste e modais) atropelaria a mão da pessoa se atualizasse no meio. A
 * atualização então ESPERA a mão sair. Um renderizador só-leitura passa `false`.
 */
export function useRundownRealtime({
  eventId,
  ocupado = false,
}: {
  eventId: string;
  ocupado?: boolean;
}): void {
  const router = useRouter();
  const ocupadoRef = useRef(ocupado);
  ocupadoRef.current = ocupado;
  const atualizacaoPendente = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let timer: number | null = null;
    let pesquisa: number | null = null;
    let conectado = false;

    const aplicar = () => {
      if (ocupadoRef.current) {
        atualizacaoPendente.current = true; // guarda pra quando a mão sair
        return;
      }
      // junta rajadas (reordenar mexe em vários blocos de uma vez)
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 250);
    };

    // Rede de segurança. O websocket é o caminho rápido, não o único: celular
    // dorme e derruba a conexão, wi-fi de igreja às vezes bloqueia websocket, e
    // no meio do culto ninguém vai descobrir que "parou de atualizar". Então
    // também perguntamos de tempos em tempos — devagar quando o tempo real está
    // de pé, rápido quando ele caiu.
    const repesquisar = () => {
      if (pesquisa) window.clearInterval(pesquisa);
      pesquisa = window.setInterval(aplicar, conectado ? 30_000 : 8_000);
    };

    const canal = supabase
      .channel(`roteiro:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_rundown", filter: `event_id=eq.${eventId}` },
        aplicar,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        aplicar,
      )
      // Mensagem no telão (0050): sem filtro de evento de propósito — ela é da
      // IGREJA, e a faixa "no telão agora" tem que acender em todas as telas,
      // inclusive na de quem está olhando outro culto.
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_messages" }, aplicar)
      .subscribe((status) => {
        conectado = status === "SUBSCRIBED";
        repesquisar();
      });
    repesquisar();

    // Voltou pro app depois de bloquear a tela: o socket provavelmente morreu
    // enquanto estava em segundo plano. Busca na hora, sem esperar o intervalo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") aplicar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      if (timer) window.clearTimeout(timer);
      if (pesquisa) window.clearInterval(pesquisa);
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // A mão saiu (soltou o bloco, fechou o modal) e tinha mudança esperando.
  useEffect(() => {
    if (ocupado || !atualizacaoPendente.current) return;
    atualizacaoPendente.current = false;
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocupado]);
}
