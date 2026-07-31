"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { EventEscalaModal } from "@/components/event/event-escala-modal";

/**
 * O modal da escala mora AQUI, no layout — não na rota.
 *
 * Antes o estado do modal era a URL: abrir uma escala era `router.push`
 * pra /escalas/[id], que renderizava a aba Escalas inteira com o modal aberto.
 * Isso custava três coisas de uma vez: você saía da tela onde estava (tocar num
 * card na Home te jogava na aba Escalas), cada abertura eram dois carregamentos
 * em série (a lista no servidor + o detalhe no cliente), e fechar era outra
 * navegação. Com o modal no layout, tocar num card é estado local: ele sobe na
 * hora, por cima de onde você já está, em qualquer tela.
 *
 * Deep-link (/escalas/[id] das notificações) continua funcionando: a EscalasView
 * pede a abertura ao montar.
 */
type EventModalCtx = {
  /** Abre o modal da escala desse evento, sem sair da tela atual. */
  abrirEscala: (eventId: string) => void;
  fechar: () => void;
};

const Ctx = createContext<EventModalCtx | null>(null);

/**
 * Devolve o controle do modal, ou `null` fora do provider — quem chama decide o
 * fallback (hoje os cards navegam pra /escalas/[id], que é o comportamento
 * antigo). Assim nada quebra se um card for renderizado fora do layout do app.
 */
export function useEventModal(): EventModalCtx | null {
  return useContext(Ctx);
}

export function EventModalProvider({
  children,
  serverKey,
}: {
  children: React.ReactNode;
  /**
   * Valor novo a cada render do LAYOUT (server component). Serve de sinal de
   * "os dados do servidor mudaram": qualquer ação dentro do modal chama
   * `router.refresh()`, o layout re-renderiza, e o modal busca o detalhe de novo
   * — é assim que a pessoa que você acabou de escalar aparece na lista sem
   * fechar o sheet. Antes esse papel era do array de eventos passado pela rota;
   * agora não depende de estar na aba Escalas.
   */
  serverKey?: string;
}) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const abrirEscala = useCallback((id: string) => {
    setEventId(id);
    setTick((n) => n + 1); // reabrir o mesmo evento busca de novo
  }, []);
  const fechar = useCallback(() => setEventId(null), []);

  return (
    <Ctx.Provider value={{ abrirEscala, fechar }}>
      {children}
      <EventEscalaModal eventId={eventId} revalidateKey={`${serverKey ?? ""}:${tick}`} onClose={fechar} />
    </Ctx.Provider>
  );
}
