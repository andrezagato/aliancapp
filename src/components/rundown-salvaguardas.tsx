"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SALVAGUARDAS DO MODO AO VIVO — as três travas que faltavam em 09/08/2026.
 *
 * O acidente: a Produção iniciou o culto às 13:10:40 e encerrou às 13:10:45.
 * Quatro segundos e meio. Reconstituindo, três defeitos nossos empilhados:
 *
 *  1. O DESTRUTIVO HERDA O PIXEL DO SEGURO. Na régia o "Iniciar" sai do DOM e o
 *     "Encerrar" entra no mesmo lugar do flex, mesma altura, mesma largura. Quem
 *     tocou de novo achando que o primeiro toque não pegou encerrou o culto.
 *  2. NÃO HAVIA CARÊNCIA. O botão novo já nascia clicável no mesmo quadro.
 *  3. NÃO HAVIA VOLTA. Só existia "reiniciar", que apaga o start e os tiques —
 *     remédio pior que a doença. Sem saída, abandonaram o culto do dia.
 *
 * Daí as três peças aqui: `useCarencia` (o botão novo nasce dormindo),
 * `BotaoSegurar` (o destrutivo exige intenção contínua, não um toque) e
 * `FaixaEncerrado` (a porta de volta, sempre visível enquanto estiver encerrado).
 *
 * Por que segurar em vez de `window.confirm`: dois diálogos nativos seguidos
 * treinam o dedo a tocar "OK" sem ler — e foi o que quase certamente aconteceu
 * no celular, que tinha confirmação e mesmo assim encerrou. Um gesto contínuo de
 * 1,5s não tem como ser feito por reflexo.
 */

/** Quanto tempo um controle recém-nascido fica dormindo. */
const CARENCIA_MS = 3000;
/** Quanto tempo é preciso segurar para uma ação destrutiva valer. */
const SEGURAR_MS = 1500;
/** Abaixo disso, um culto encerrado é suspeito de acidente e a faixa grita. */
const CURTO_DEMAIS_MS = 5 * 60 * 1000;

/**
 * Trava tudo por alguns segundos depois de uma transição de estado. É a única
 * das três que protege contra erros que ainda não imaginamos: qualquer botão que
 * apareça no lugar de outro nasce inerte, independente de qual seja.
 */
export function useCarencia(ms = CARENCIA_MS): [boolean, () => void] {
  const [travado, setTravado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armar = useCallback(() => {
    setTravado(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTravado(false), ms);
  }, [ms]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return [travado, armar];
}

/**
 * Botão que só dispara depois de segurar. O progresso é uma varredura horizontal
 * em `currentColor` — funciona igual na pílula larga da régia e no botão redondo
 * do celular, e herda o tom telha de quem o usa sem precisar de prop de cor.
 *
 * Soltar antes do fim cancela e volta a zero. Teclado não segura bem, então quem
 * chega por Enter/Espaço cai num confirm — o gesto é a proteção do dedo, não do
 * teclado, e ninguém opera régia de culto no Tab.
 */
export function BotaoSegurar({
  aoConfirmar,
  textoTeclado,
  children,
  className,
  duracaoMs = SEGURAR_MS,
  desabilitado,
  ...resto
}: {
  aoConfirmar: () => void;
  /** Pergunta do confirm no caminho de teclado. */
  textoTeclado: string;
  children: React.ReactNode;
  className?: string;
  duracaoMs?: number;
  desabilitado?: boolean;
  "aria-label"?: string;
  title?: string;
}) {
  const [progresso, setProgresso] = useState(0);
  const quadro = useRef<number | null>(null);
  const inicio = useRef(0);

  const parar = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
    setProgresso(0);
  }, []);

  useEffect(() => parar, [parar]);

  const comecar = () => {
    if (desabilitado || quadro.current !== null) return;
    inicio.current = performance.now();
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio.current) / duracaoMs);
      setProgresso(p);
      if (p >= 1) {
        parar();
        aoConfirmar();
        return;
      }
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  };

  return (
    <button
      type="button"
      disabled={desabilitado}
      onPointerDown={(e) => {
        e.preventDefault();
        comecar();
      }}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (window.confirm(textoTeclado)) aoConfirmar();
      }}
      className={cn("relative isolate overflow-hidden disabled:opacity-40", className)}
      style={{ touchAction: "none" }}
      {...resto}
    >
      {/* A varredura fica ATRÁS do conteúdo (`isolate` + `-z-10` pinta acima do
          fundo do botão e abaixo do texto) e não intercepta ponteiro: soltar o
          dedo em cima dela tem que cancelar, não virar clique novo. Envolver os
          filhos num wrapper quebraria o layout de quem chama — este botão nasce
          tanto `grid place-items-center` quanto `inline-flex gap`. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 origin-left bg-current opacity-25"
        style={{ transform: `scaleX(${progresso})` }}
      />
      {children}
    </button>
  );
}

/** "5 segundos" / "3 min" — o número é o argumento da faixa, tem que ser exato. */
function duracaoTexto(ms: number): string {
  const seg = Math.max(0, Math.round(ms / 1000));
  if (seg < 60) return `${seg} segundo${seg === 1 ? "" : "s"}`;
  return `${Math.round(seg / 60)} min`;
}

/**
 * A porta de volta. Fica no lugar do roteiro enquanto o culto estiver encerrado,
 * e não some sozinha — quem abre a tela dez minutos depois (que pode não ser
 * quem errou) precisa achar o caminho de volta sem perguntar pra ninguém.
 *
 * Dois tons de propósito: encerramento normal é uma linha calma com o desfazer
 * discreto; encerramento de 5 segundos, ou sem nenhum bloco ticado, é acidente
 * até prova em contrário e a faixa fala alto.
 */
export function FaixaEncerrado({
  startedAt,
  endedAt,
  algumTique,
  aoReabrir,
  ocupado,
  em,
}: {
  startedAt: string | null;
  endedAt: string;
  /** Se nenhum bloco foi ticado, o culto provavelmente nunca aconteceu. */
  algumTique: boolean;
  aoReabrir: () => void;
  ocupado?: boolean;
  /** Régia: dimensiona em `em` pra acompanhar o controle de fonte da sala. */
  em?: boolean;
}) {
  const duracaoMs = startedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : 0;
  const suspeito = !algumTique || (startedAt != null && duracaoMs < CURTO_DEMAIS_MS);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3",
        em && "rounded-[0.8em] px-[0.9em] py-[0.6em] text-[0.9em]",
        suspeito ? "border-warning/40 bg-warning/10" : "border-border bg-muted/40",
      )}
    >
      {suspeito ? (
        <TriangleAlert className={cn("size-5 shrink-0 text-warning-ink", em && "size-[1.2em]")} />
      ) : null}
      <p className={cn("min-w-0 flex-1 text-sm", em && "text-[1em]")}>
        {suspeito ? (
          <>
            <strong className="font-extrabold text-warning-ink">
              Este culto foi encerrado depois de {duracaoTexto(duracaoMs)}
              {!algumTique ? ", sem nenhum bloco concluído" : ""}.
            </strong>{" "}
            <span className="text-muted-foreground">Foi sem querer? Reabrir devolve o culto exatamente de onde parou.</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            Culto encerrado. O relógio parou e a avaliação da equipe já foi liberada.
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={aoReabrir}
        disabled={ocupado}
        className={cn(
          "press-sm inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold disabled:opacity-60",
          em && "gap-[0.4em] px-[0.9em] py-[0.4em] text-[0.95em]",
          suspeito
            ? "bg-warning text-warning-foreground"
            : "border border-border text-muted-foreground",
        )}
      >
        <RotateCcw className={cn("size-4", em && "size-[1.1em]")} />
        {suspeito ? "Reabrir culto" : "Reabrir"}
      </button>
    </div>
  );
}
