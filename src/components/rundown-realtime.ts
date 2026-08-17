"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * DE QUANTO EM QUANTO TEMPO A REDE DE SEGURANÇA PERGUNTA.
 *
 * Com o culto ROLANDO, a sincronia vale o custo: um bloco encerrado tem que
 * aparecer na mão de todo mundo em segundos.
 *
 * PARADO, não vale nada. E "parado" é quase sempre: a régia fica num monitor da
 * sala, ligada a semana inteira, pra um culto de duas horas por semana. Até
 * aqui ela perguntava a cada 30 segundos às 3 da manhã de quarta — e cada
 * pergunta é uma renderização INTEIRA de /control no servidor, que custa umas
 * treze consultas de evento (`listarCandidatosDeRoteiro` chama `getRundownState`
 * uma vez por candidato). Era a maior parte das 165 mil requisições por dia que
 * a igreja fazia com 54 pessoas.
 *
 * Fora do culto o websocket continua de pé e avisa na hora; este laço é só a
 * rede pra quando ele cai (celular que dormiu, wi-fi de igreja que bloqueia).
 * Rede não precisa ser rápida — precisa existir.
 */
const PASSO = {
  aoVivo: { conectado: 30_000, caido: 8_000 },
  /**
   * TETO AMARRADO À MENSAGEM DE PALCO. `enviar_stage_message` nasce com 3 min
   * (`p_minutos` default 3, mínimo 1), e este laço é a rede DELA também — a
   * assinatura de `stage_messages` é sem filtro de evento justamente pra
   * acender em tela que NÃO está num culto vivo. Passo maior que a vida da
   * mensagem a deixaria nascer e morrer entre duas perguntas.
   *
   * A regra, pra quem mexer aqui depois: o passo mais lento tem que ser menor
   * que o TTL mais curto de qualquer coisa da qual este laço é a rede.
   */
  parado: { conectado: 120_000, caido: 30_000 },
};

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
  aoVivo = true,
}: {
  eventId: string;
  ocupado?: boolean;
  /**
   * O culto está acontecendo agora (começou e não encerrou)? Só isso decide o
   * ritmo da rede de segurança — ver `PASSO`. Padrão `true` de propósito: quem
   * esquecer de passar continua com o comportamento antigo, que é o seguro.
   */
  aoVivo?: boolean;
}): void {
  const router = useRouter();
  const ocupadoRef = useRef(ocupado);
  ocupadoRef.current = ocupado;
  // Escrito no COMMIT (no efeito lá embaixo), nunca durante o render: o App
  // Router roda em modo concorrente e estas telas usam `startTransition`, então
  // um render descartado deixaria o ref mentindo — e errar aqui pro lado
  // "parado" é sincronia lenta no meio do culto.
  const aoVivoRef = useRef(aoVivo);
  const atualizacaoPendente = useRef(false);
  /**
   * A função que re-arma o intervalo, exposta pra fora do efeito principal.
   *
   * Existe pra que começar ou encerrar o culto NÃO entre nas dependências
   * daquele efeito: se entrasse, o canal do websocket seria derrubado e
   * reassinado bem no instante em que a sincronia mais importa.
   */
  const rearmarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let timer: number | null = null;
    let pesquisa: number | null = null;
    let conectado = false;
    /** Este efeito já foi limpo — ver a trava no callback do `subscribe`. */
    let morto = false;

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
    // A batida do laço. Aba escondida não PERGUNTA — mas o intervalo continua
    // ARMADO. Desarmar e rearmar a cada troca de aba faria duas coisas ruins: a
    // existência da rede passaria a depender de o `visibilitychange` chegar (e
    // ele não chega no bfcache, no freeze do Page Lifecycle, no PWA do iOS
    // voltando do multitarefa), e cada volta zeraria a contagem — com 2 min
    // parado, quem alterna janelas nunca deixaria o laço completar. Assim, se o
    // evento falhar, perde-se uma batida, não a rede.
    // Timer em aba escondida o navegador já estrangula pra 1/min sozinho: o
    // custo de deixá-lo armado é desprezível, e o de desarmá-lo era a rede toda.
    const pulsar = () => {
      if (document.visibilityState === "hidden") return;
      aplicar();
    };

    const repesquisar = () => {
      if (pesquisa) window.clearInterval(pesquisa);
      const passo = aoVivoRef.current ? PASSO.aoVivo : PASSO.parado;
      pesquisa = window.setInterval(pulsar, conectado ? passo.conectado : passo.caido);
    };
    rearmarRef.current = repesquisar;

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
      // Mensagem no monitor de palco (0050): sem filtro de evento de propósito — ela
      // é da IGREJA, e a faixa "no monitor agora" tem que acender em todas as telas,
      // inclusive na de quem está olhando outro culto.
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_messages" }, aplicar)
      .subscribe((status) => {
        // O 'CLOSED' do `removeChannel` chega DEPOIS desta limpeza: o
        // `unsubscribe` da realtime-js dispara o binding de close no ack do
        // leave — ou na hora, se o socket já tinha caído. Sem esta trava, cada
        // desmonte (navegar pra fora, trocar de `?ev=`) deixava um setInterval
        // ÓRFÃO chamando `router.refresh()` pra sempre, de closure morta.
        if (morto) return;
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
      morto = true;
      if (timer) window.clearTimeout(timer);
      if (pesquisa) window.clearInterval(pesquisa);
      rearmarRef.current = null;
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // O culto começou ou encerrou: troca o ritmo SEM derrubar o websocket. É por
  // isso que `aoVivo` não entra nas dependências do efeito de cima — e é aqui,
  // no commit, que o ref é escrito.
  useEffect(() => {
    aoVivoRef.current = aoVivo;
    rearmarRef.current?.();
  }, [aoVivo]);

  // A mão saiu (soltou o bloco, fechou o modal) e tinha mudança esperando.
  useEffect(() => {
    if (ocupado || !atualizacaoPendente.current) return;
    atualizacaoPendente.current = false;
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocupado]);
}
