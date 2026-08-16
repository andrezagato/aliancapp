"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * POPOVER DE DURAÇÃO — o número vira o próprio controle.
 *
 * Nasceu quando a alça de arrastar a borda de baixo do bloco saiu do roteiro do
 * celular. Sem ela, mudar 5 minutos passaria a exigir abrir o modal do bloco,
 * achar o campo e salvar — três toques e um teclado virtual no meio do culto.
 * Aqui o número é o gatilho e CADA TOQUE JÁ VALE: o pai aplica na hora e manda
 * pro servidor com atraso. Por isso tocar fora não "confirma" nada, só fecha; e
 * por isso existe um "Pronto" — sumir sem botão deixa a pessoa procurando o que
 * apertar.
 *
 * NÃO usa portal, de propósito. A régia aplica `.dark` num CONTAINER e dimensiona
 * tudo em `em` a partir do font-size que os botões A−/A+ mudam: um portal no
 * <body> cairia fora dos dois. Ancorado no pai ele herda os tokens e a escala.
 * É a mesma escolha do MenuCulto.
 */

/** Nunca zero nem negativo: bloco de 0 min some da projeção e quebra a leitura. */
const MIN_MIN = 1;
/** 4h. Teto contra toque repetido no "+5", longe de qualquer bloco real. */
const MAX_MIN = 240;
/** Altura real do painel, com folga — usada só pra decidir pra que lado abrir. */
const ALTURA_PAINEL = 230;

export function DuracaoPopover({
  valor,
  aberto,
  onAbrir,
  onFechar,
  onMudar,
  rotuloBloco,
  gatilho,
  em = false,
  abrirPara = "cima",
  className,
  classeGatilho,
}: {
  valor: number;
  /** Controlado pelo pai: só ele sabe travar o tempo real enquanto está aberto. */
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onMudar: (min: number) => void;
  /** Pro leitor de tela saber de qual bloco é esta duração. */
  rotuloBloco: string;
  /** O que o gatilho mostra. Sem isto, "12m". A régia manda a regressiva ao vivo. */
  gatilho?: React.ReactNode;
  /** Régia: dimensiona em `em` pra acompanhar o controle de fonte da sala. */
  em?: boolean;
  /** Preferência de lado; se não couber, ele vira sozinho. */
  abrirPara?: "cima" | "baixo";
  className?: string;
  classeGatilho?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const [paraCima, setParaCima] = useState(abrirPara === "cima");

  // Pra que lado abrir: a preferência manda, mas quem decide é o espaço. No
  // celular o primeiro bloco fica embaixo do cabeçalho grudado, e na régia a
  // última linha fica na borda do scroller — nos dois casos o lado preferido
  // nasceria fora da tela.
  useEffect(() => {
    if (!aberto) return;
    const r = gatilhoRef.current?.getBoundingClientRect();
    if (!r) return;
    const cabeCima = r.top >= ALTURA_PAINEL + 12;
    const cabeBaixo = window.innerHeight - r.bottom >= ALTURA_PAINEL + 12;
    setParaCima(abrirPara === "cima" ? cabeCima || !cabeBaixo : !cabeBaixo && cabeCima);
  }, [aberto, abrirPara]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) onFechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // O Modal escuta Escape na `window`; `document` vem antes no caminho do
      // evento, então parar aqui impede que um sheet por trás feche junto.
      e.stopPropagation();
      onFechar();
      gatilhoRef.current?.focus();
    };
    // Foca o DIÁLOGO, não o primeiro botão: com o valor no mínimo o "−1" nasce
    // desabilitado e o leitor de tela nunca entraria no popover.
    dialogoRef.current?.focus();
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const ajustar = (delta: number) => onMudar(Math.min(MAX_MIN, Math.max(MIN_MIN, valor + delta)));

  const classeBotao = cn(
    "press grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground disabled:opacity-35",
    em && "size-[2.4em]",
  );
  const classeIcone = cn("size-5", em && "size-[1.1em]");
  const classePasso = cn(
    "flex-1 text-center text-[12.5px] font-bold tabular-nums text-muted-foreground",
    em && "text-[0.9em]",
  );

  return (
    <div ref={caixa} className={cn("relative", className)}>
      <button
        ref={gatilhoRef}
        type="button"
        onClick={(e) => {
          // O card inteiro abre o modal de editar bloco. O número não pode levar
          // junto — e na régia a linha tem controles vizinhos.
          e.stopPropagation();
          if (aberto) onFechar();
          else onAbrir();
        }}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Duração de ${rotuloBloco}: ${valor} minutos. Toque para ajustar.`}
        className={cn("press-sm tabular-nums", aberto && "text-primary", classeGatilho)}
      >
        {gatilho ?? `${valor}m`}
      </button>

      {aberto ? (
        <div
          ref={dialogoRef}
          role="dialog"
          tabIndex={-1}
          aria-label="Ajustar duração"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // `max-w` amarrado à viewport: o roteiro roda em 360px e a coluna da
            // régua encosta na goteira esquerda — sem isto o popover sairia pela
            // direita da tela. Mesmo recurso do MenuCulto.
            "absolute left-0 z-40 w-[15rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 shadow-lift outline-none",
            paraCima ? "bottom-full mb-2" : "top-full mt-2",
            em && "w-[15em] rounded-[0.9em] p-[0.6em]",
          )}
        >
          <p
            aria-live="polite"
            className={cn(
              "mb-2.5 text-center font-display text-[22px] font-extrabold leading-none tabular-nums text-foreground",
              em && "mb-[0.5em] text-[1.35em]",
            )}
          >
            {valor} min
          </p>

          <div className={cn("flex items-center gap-2", em && "gap-[0.4em]")}>
            <button
              type="button"
              onClick={() => ajustar(-1)}
              disabled={valor <= MIN_MIN}
              aria-label="Diminuir 1 minuto"
              className={classeBotao}
            >
              <Minus className={classeIcone} strokeWidth={2.6} />
            </button>
            <span className={classePasso}>1</span>
            <button
              type="button"
              onClick={() => ajustar(1)}
              disabled={valor >= MAX_MIN}
              aria-label="Aumentar 1 minuto"
              className={classeBotao}
            >
              <Plus className={classeIcone} strokeWidth={2.6} />
            </button>
          </div>

          <div className={cn("mt-2 flex items-center gap-2", em && "mt-[0.4em] gap-[0.4em]")}>
            <button
              type="button"
              onClick={() => ajustar(-5)}
              disabled={valor <= MIN_MIN}
              aria-label="Diminuir 5 minutos"
              className={classeBotao}
            >
              <Minus className={classeIcone} strokeWidth={2.6} />
            </button>
            <span className={classePasso}>5</span>
            <button
              type="button"
              onClick={() => ajustar(5)}
              disabled={valor >= MAX_MIN}
              aria-label="Aumentar 5 minutos"
              className={classeBotao}
            >
              <Plus className={classeIcone} strokeWidth={2.6} />
            </button>
          </div>

          {/* "Pronto" não confirma nada — cada toque já valeu. Ele é a saída
              óbvia: sem botão, quem não sabe que "tocar fora fecha" fica preso. */}
          <button
            type="button"
            onClick={onFechar}
            className={cn(
              "press mt-3 h-10 w-full rounded-full bg-primary text-[15px] font-extrabold text-primary-foreground",
              em && "mt-[0.5em] h-[2.4em] text-[0.9em]",
            )}
          >
            Pronto
          </button>
        </div>
      ) : null}
    </div>
  );
}
