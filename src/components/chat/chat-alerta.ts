"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import {
  REPIQUES,
  REPIQUE_MS,
  emitirFlash,
  tocarAlerta,
  vibrar,
} from "@/lib/alerta";
import type { CanalChat } from "@/lib/chat";

/**
 * O VIGIA DO CHAT — uma assinatura só, pra todos os canais que a pessoa vê.
 *
 * Antes disto, quem só assinava era a conversa ABERTA: mensagem em outro canal
 * não tocava, não piscava e não mexia nem no badge — o número só aparecia no
 * próximo `router.refresh()`. Na régia isso significava que um recado no canal
 * do Louvor podia ficar invisível o culto inteiro.
 *
 * A assinatura vai SEM filtro e a peneira é aqui, do lado do cliente: é o mesmo
 * caminho que a conversa já usava (a RLS decide o que chega), e filtro por canal
 * no servidor exigiria uma assinatura por canal — dez canais, dez websockets.
 *
 * Não alerta: mensagem própria, canal silenciado, canal fora da lista e canal que
 * está sendo LIDO agora (`lendoAgora`). A régia não passa `lendoAgora` de
 * propósito: o painel do chat vive aberto ali, e "está na tela" não é a mesma
 * coisa que "alguém leu" — era justamente essa confusão que fazia a mensagem mais
 * importante, a do canal do culto, ser a única a nunca avisar.
 */

export type MensagemChegada = {
  id: string;
  tipo: string;
  ref: string;
  /** Rótulo do canal, pra barra de aviso dizer de onde veio. */
  canal: string;
  autor: string;
  texto: string;
  criadaEm: string;
};

export function useAlertaDeMensagens({
  canais,
  meId,
  volume,
  somLigado,
  lendoAgora,
  comVibracao = false,
  aoChegar,
}: {
  canais: CanalChat[];
  meId: string;
  volume: number;
  somLigado: boolean;
  /** Este canal está sendo lido na tela agora? (celular: modal aberto nele) */
  lendoAgora?: (tipo: string, ref: string) => boolean;
  comVibracao?: boolean;
  /** Chamado a cada chegada — quem cuida do badge incrementa por aqui. */
  aoChegar?: (m: MensagemChegada) => void;
}): {
  novas: MensagemChegada[];
  /** Alguém olhou: limpa a barra e corta o repique. */
  reconhecer: () => void;
  /** Houve alerta e o som NÃO saiu (navegador ainda travado). */
  mudo: boolean;
} {
  const [novas, setNovas] = useState<MensagemChegada[]>([]);
  const [mudo, setMudo] = useState(false);

  // Refs pra assinatura não se refazer a cada render do servidor: `canais` vem
  // como array novo toda vez, e recriar o websocket no meio do culto é
  // exatamente o tipo de piscada que faz perder mensagem.
  const canaisRef = useRef(canais);
  canaisRef.current = canais;
  const lendoRef = useRef(lendoAgora);
  lendoRef.current = lendoAgora;
  const aoChegarRef = useRef(aoChegar);
  aoChegarRef.current = aoChegar;
  const somRef = useRef(somLigado);
  somRef.current = somLigado;
  const volRef = useRef(volume);
  volRef.current = volume;
  const vibraRef = useRef(comVibracao);
  vibraRef.current = comVibracao;

  const avisar = useCallback(() => {
    emitirFlash();
    if (!somRef.current) return;
    const saiu = tocarAlerta(volRef.current);
    setMudo(!saiu);
    if (vibraRef.current) vibrar();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    let vivo = true;

    const sub = supabase
      .channel("chat-alerta")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const m = payload.new as {
            id: string;
            body: string;
            sender_id: string;
            created_at: string;
            channel_type: string;
            channel_ref: string;
          };
          if (m.sender_id === meId) return;
          const canal = canaisRef.current.find(
            (c) => c.type === m.channel_type && c.ref === m.channel_ref,
          );
          if (!canal || canal.muted) return;
          if (lendoRef.current?.(m.channel_type, m.channel_ref)) return;

          const { data: p } = await supabase
            .from("profiles")
            .select("full_name, nickname")
            .eq("id", m.sender_id)
            .maybeSingle();
          if (!vivo) return;
          const row = p as { nickname: string | null; full_name: string } | null;
          const chegada: MensagemChegada = {
            id: m.id,
            tipo: m.channel_type,
            ref: m.channel_ref,
            canal: canal.label,
            autor: row?.nickname || row?.full_name || "Alguém",
            texto: m.body,
            criadaEm: m.created_at,
          };
          setNovas((prev) => (prev.some((x) => x.id === chegada.id) ? prev : [...prev, chegada]));
          aoChegarRef.current?.(chegada);
          avisar();
        },
      )
      .subscribe();

    return () => {
      vivo = false;
      supabase.removeChannel(sub);
    };
  }, [meId, avisar]);

  /**
   * O REPIQUE. Reinicia sozinho a cada mensagem nova (a dependência é a
   * QUANTIDADE), e morre depois de `REPIQUES` — som que nunca cala é som que o
   * ouvido aprende a apagar, e aí o alerta virou ruído de fundo.
   */
  useEffect(() => {
    if (novas.length === 0) return;
    let n = 0;
    const t = window.setInterval(() => {
      n += 1;
      avisar();
      if (n >= REPIQUES) window.clearInterval(t);
    }, REPIQUE_MS);
    return () => window.clearInterval(t);
  }, [novas.length, avisar]);

  /**
   * A aba conta. A régia às vezes fica atrás de outra janela no PC da cabine, e
   * o título é o único aviso que atravessa a barra de tarefas.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const limpo = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = novas.length > 0 ? `(${novas.length}) ${limpo}` : limpo;
  }, [novas.length]);

  const reconhecer = useCallback(() => {
    setNovas((prev) => (prev.length === 0 ? prev : []));
    setMudo(false);
  }, []);

  return { novas, reconhecer, mudo };
}
