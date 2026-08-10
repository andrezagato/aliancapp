"use client";

import { useEffect, useState } from "react";
import { MessageSquareDot } from "lucide-react";
import { Conversation, canPostNoCanal } from "@/components/chat/chat-modal";
import { useAlertaDeMensagens, type MensagemChegada } from "@/components/chat/chat-alerta";
import { BotaoSom } from "@/components/chat/botao-som";
import { useSomDeAlerta, VOL_REGIA } from "@/lib/alerta";
import { cn } from "@/lib/utils";
import type { CanalChat } from "@/lib/chat";

/**
 * Chat da régia: uma tira de canais + a conversa aberta.
 *
 * Diferente do balão do celular, que tem 3 abas (Geral/Eventos/Equipes) porque a
 * tela é estreita, aqui cabe tudo numa linha só — na régia o operador precisa
 * pular de "Produção" pra "Louvor" e voltar pro culto sem navegar em dois
 * níveis. Abre no canal do CULTO, que é a conversa da operação.
 *
 * Também existe por uma razão de fronteira: /control é Server Component, e de lá
 * não dá pra chamar função de módulo "use client" nem passar callback como prop
 * — era isso que derrubava a página. O servidor manda só dados; decisão de
 * permissão e callbacks moram aqui.
 *
 * É AQUI QUE O ALERTA VIVE. O chat virou a via oficial entre a Produção no palco
 * e a cabine no fundo, e via de comunicação que depende de alguém estar olhando
 * pra tela não é via, é sorte. Então: som (com repique), pisca na tela inteira e
 * uma barra que NÃO SOME até alguém tocar no painel. O reconhecimento é qualquer
 * toque aqui dentro — quem mexeu no chat olhou pro chat, e obrigar um "OK" a mais
 * seria só treinar o dedo a dispensar avisos sem ler.
 */
export function ControlChat({
  canais,
  eventoId,
  meId,
  role,
}: {
  canais: CanalChat[];
  eventoId: string;
  meId: string;
  role: "admin" | "leader" | "volunteer";
}) {
  /**
   * Canal do culto primeiro — é o que a régia usa o tempo todo. Depois EQUIPE, e
   * só então o que sobrar.
   *
   * A equipe no meio não é capricho: o canal de culto só existe pra quem está
   * escalado nele ou lidera equipe com requisito nele (RLS, migration 0037). Num
   * culto de oração, onde a Produção não é escalada, esse canal simplesmente não
   * existe pra régia — e o primeiro da lista é "Avisos gerais", onde ela nem
   * pode postar. Abrir a via oficial de comunicação numa tela somente-leitura é
   * pior que não abrir: parece que funciona.
   */
  const inicial =
    canais.find((c) => c.type === "evento" && c.ref === eventoId) ??
    canais.find((c) => c.type === "equipe") ??
    canais[0] ??
    null;
  const [ativo, setAtivo] = useState<CanalChat | null>(inicial);

  // Cópia local só pro badge dos canais FECHADOS: o Realtime incrementa aqui e o
  // número aparece na hora, em vez de esperar o próximo render do servidor (que
  // no /control só acontece quando o roteiro muda — ou seja, quase nunca).
  // Quando o servidor manda lista nova, ela vence: ali a contagem é a verdadeira.
  const [lista, setLista] = useState(canais);
  useEffect(() => setLista(canais), [canais]);

  const som = useSomDeAlerta(VOL_REGIA);
  const { novas, reconhecer, mudo } = useAlertaDeMensagens({
    canais: lista,
    meId,
    volume: VOL_REGIA,
    somLigado: som.ligado,
    // Sem `lendoAgora`: na régia o painel vive aberto, e "está na tela" não é
    // "alguém leu". Se o canal aberto não alertasse, o canal do culto — o mais
    // importante — seria justamente o único mudo.
    aoChegar: (m) =>
      setLista((prev) =>
        prev.map((c) =>
          c.type === m.tipo && c.ref === m.ref
            ? { ...c, lastAt: m.criadaEm, unread: c.unread + 1 }
            : c,
        ),
      ),
  });

  const abrir = (c: CanalChat) => {
    setAtivo(c);
    setLista((prev) =>
      prev.map((x) => (x.type === c.type && x.ref === c.ref ? { ...x, unread: 0 } : x)),
    );
  };

  const irParaAUltima = () => {
    const ultima = novas[novas.length - 1];
    const destino = ultima
      ? lista.find((c) => c.type === ultima.tipo && c.ref === ultima.ref)
      : null;
    if (destino) abrir(destino);
    reconhecer();
  };

  if (!ativo) {
    return (
      <p className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">
        Nenhum canal de chat disponível.
      </p>
    );
  }

  return (
    // O reconhecimento mora no capture: vale pro toque no botão de canal, no
    // campo de texto, na rolagem da conversa — qualquer sinal de que a pessoa
    // está no chat. Capture pra não depender de o filho deixar o evento subir.
    <div className="flex min-h-0 flex-1 flex-col" onPointerDownCapture={reconhecer}>
      {novas.length > 0 ? (
        <BarraNovas novas={novas} mudo={mudo} onVer={irParaAUltima} onLiberarSom={som.liberar} />
      ) : null}

      <div className="-mx-1 mb-1 flex shrink-0 items-center gap-1.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lista.map((c) => {
          const on = c.type === ativo.type && c.ref === ativo.ref;
          const doCulto = c.type === "evento" && c.ref === eventoId;
          return (
            <button
              key={`${c.type}:${c.ref}`}
              onClick={() => abrir(c)}
              className={cn(
                "press-sm flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                on ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
                c.type === "evento" && c.past ? "opacity-55" : "",
              )}
              style={c.type === "equipe" && c.color && !on ? { color: c.color } : undefined}
            >
              {c.type === "equipe" && c.color ? (
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              ) : null}
              <span className="max-w-[10rem] truncate">{doCulto ? "Este culto" : c.label}</span>
              {c.unread > 0 && !on ? (
                <span className="grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground">
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              ) : null}
            </button>
          );
        })}
        {/* O interruptor de som fica GRUDADO no fim da tira, fora da rolagem dos
            canais: quando ele está âmbar pedindo liberação, é a coisa mais
            importante desta coluna e não pode depender de rolar pra aparecer. */}
        <span className="sticky right-0 ml-auto shrink-0 bg-card pl-1.5">
          <BotaoSom estado={som} />
        </span>
      </div>

      {/* key: trocar de canal remonta a conversa (zera mensagens e o realtime do
          canal anterior) em vez de misturar históricos */}
      <Conversation
        key={`${ativo.type}:${ativo.ref}`}
        channel={ativo}
        meId={meId}
        canPost={canPostNoCanal(ativo.type, role)}
        canDelete={role === "admin"}
        onMuteChange={() => {}}
      />
    </div>
  );
}

/**
 * A BARRA QUE NÃO SOME. Fica no topo do painel enquanto houver mensagem não
 * reconhecida, com quem falou e o começo do que disse — a cabine decide se
 * interrompe o que está fazendo sem precisar ler a conversa inteira.
 *
 * Não tem botão de fechar. Fechar sem ler é o gesto que a gente NÃO quer barato:
 * quem toca aqui vai pro canal da mensagem, e é isso que apaga a barra.
 */
function BarraNovas({
  novas,
  mudo,
  onVer,
  onLiberarSom,
}: {
  novas: MensagemChegada[];
  mudo: boolean;
  onVer: () => void;
  onLiberarSom: () => void;
}) {
  const ultima = novas[novas.length - 1];
  return (
    <div className="mb-1.5 shrink-0 overflow-hidden rounded-[14px] border border-primary/40 bg-primary/10">
      <button onClick={onVer} className="press-sm flex w-full items-start gap-2 px-2.5 py-2 text-left">
        <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <MessageSquareDot className="size-3.5" />
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-extrabold text-primary">
              {novas.length === 1 ? "1 mensagem nova" : `${novas.length} mensagens novas`}
            </span>
            <span className="truncate text-[11px] font-semibold text-muted-foreground">{ultima.canal}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-foreground">
            <strong className="font-bold">{ultima.autor}:</strong> {ultima.texto}
          </span>
        </span>
      </button>
      {/* O pior estado possível: alerta na tela e navegador mudo. Dizer isso é o
          mínimo — a cabine tem que saber que o apito NÃO tocou. */}
      {mudo ? (
        <button
          onClick={onLiberarSom}
          className="press-sm flex w-full items-center gap-1.5 border-t border-warning/40 bg-warning/15 px-2.5 py-1.5 text-left text-[12px] font-extrabold text-warning-ink"
        >
          O som não tocou — o navegador pede um toque. Liberar agora.
        </button>
      ) : null}
    </div>
  );
}
