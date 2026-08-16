"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet (mobile) / diálogo centrado (desktop) via portal no <body>.
 * O portal escapa de qualquer ancestral com `transform` (ex.: `.animate-*`,
 * cujo transform final vira containing block) — sem isso o `position: fixed`
 * se ancora no ancestral e o sheet "cai" no meio da página em vez de colar
 * embaixo. Sobe com mola (`animate-sheet`) sobre um véu que faz fade
 * (`animate-scrim`). Passe `sheet` para o visual "Aconchego" (pega dourada +
 * cantos arredondados + título serif); sem ele, é só um contêiner com mola.
 *
 * No modo `sheet` dá pra fechar arrastando a alça pra baixo (swipe-down) além
 * de Escape, clique no véu e o botão × — menos página, mais fluidez.
 */
const CLOSE_DY = 110; // arrastar a alça além disso fecha

// -----------------------------------------------------------------------------
// TRAVA DA ROLAGEM DE FUNDO
//
// O que estava aqui — `document.body.style.overflow = "hidden"` — não segura o
// iOS: quem rola a viewport lá é o DOCUMENTO, não o body. O dedo dentro do sheet
// continuava arrastando a página atrás, e como o app roda instalado (PWA) o
// efeito era o pior possível: o cabeçalho reativo se desfazendo e o
// pull-to-refresh acendendo por baixo do modal.
//
// A trava de verdade é tirar a página do fluxo (`position: fixed`) exatamente na
// altura em que ela estava, e devolver exatamente isso ao soltar. Duas
// armadilhas conhecidas, as duas tratadas aqui:
//
//  · CONTAGEM. Dois sheets podem estar abertos ao mesmo tempo (o de escala com
//    uma confirmação por cima). O primeiro a fechar NÃO pode destravar o fundo —
//    daí o contador em vez de um booleano.
//  · `scroll-behavior: smooth` no <html> (globals.css, linha 91). Sem desligar,
//    o `scrollTo` da volta ANIMA, e a página aterrissa deslizando num lugar
//    diferente de onde estava. É esse o jeito errado de fazer position:fixed.
//
// A barra de rolagem do desktop some junto com a rolagem; sem compensar, a
// página inteira dá um pulo lateral de ~10px ao abrir o modal.
// -----------------------------------------------------------------------------
let travasAtivas = 0;
let scrollSalvo = 0;

function travarFundo() {
  travasAtivas += 1;
  if (travasAtivas > 1) return;
  // O cabeçalho reativo lê window.scrollY num listener de scroll. Fixar o body
  // zera o scroll e dispara o evento: sem esta marca, o título grande se
  // re-expandiria atrás do véu translúcido, e de novo ao contrário no fechar.
  document.documentElement.dataset.scrollTravado = "1";
  scrollSalvo = window.scrollY;
  const larguraBarra = window.innerWidth - document.documentElement.clientWidth;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${scrollSalvo}px`;
  b.left = "0";
  b.right = "0";
  b.width = "100%";
  b.overflow = "hidden";
  if (larguraBarra > 0) b.paddingRight = `${larguraBarra}px`;
}

function destravarFundo() {
  travasAtivas = Math.max(0, travasAtivas - 1);
  if (travasAtivas > 0) return;
  const b = document.body.style;
  b.position = "";
  b.top = "";
  b.left = "";
  b.right = "";
  b.width = "";
  b.overflow = "";
  b.paddingRight = "";
  const html = document.documentElement.style;
  const antes = html.scrollBehavior;
  html.scrollBehavior = "auto";
  window.scrollTo(0, scrollSalvo);
  html.scrollBehavior = antes;
  delete document.documentElement.dataset.scrollTravado;
}

export function Modal({
  open,
  onClose,
  children,
  sheet = false,
  title,
  liftY = 0,
  onBack,
  backLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheet?: boolean;
  title?: string;
  /** Sobe o sheet quando o teclado virtual abre (px) — evita sobreposição no iOS. */
  liftY?: number;
  /** Quando presente, mostra "‹ backLabel" no lugar do título — ele volta em vez de fechar tudo (o X continua fechando tudo). */
  onBack?: () => void;
  backLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [dy, setDy] = useState(0);
  const [settling, setSettling] = useState(false);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ y: number } | null>(null);
  useEffect(() => setMounted(true), []);

  // Fecha animando a saída (sheet desce + véu apaga) antes de desmontar.
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setDy(0);
      onClose();
    }, 280);
  };

  // A TRAVA depende SÓ de `open`. Ela não pode morar no mesmo efeito do Escape:
  // aquele tem `onClose` nas deps, `onClose` é arrow inline em quase todo uso, e
  // nas telas de roteiro o relógio (rundown-timing.ts) re-renderiza o pai a cada
  // segundo — o efeito re-rodaria 1×/s, e com `position: fixed` isso vira
  // destravar + scrollTo + travar sem parar.
  useEffect(() => {
    if (!open) return;
    travarFundo();
    return () => destravarFundo();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY };
    setSettling(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setDy(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const ddy = e.clientY - d.y;
    setSettling(true);
    if (ddy > CLOSE_DY) requestClose();
    else setDy(0);
  };

  return createPortal(
    <div
      // `data-modal`: marca que o PullToRefresh usa pra ignorar gestos daqui de
      // dentro. O portal está no <body>, mas o React propaga evento pela árvore
      // de COMPONENTES — sem esta marca, arrastar dentro do sheet acendia o
      // "puxe para atualizar" da página atrás.
      // `overscroll-contain`: quando o conteúdo não precisa rolar, este scroller
      // chega no limite na hora e encadeava a rolagem pro documento.
      data-modal
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain sm:items-center"
      onClick={requestClose}
    >
      <div
        className={cn(
          "absolute inset-0 bg-[hsl(var(--foreground)/0.42)]",
          closing ? "animate-scrim-out" : "animate-scrim",
        )}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          closing ? "animate-sheet-out" : "animate-sheet",
          "relative w-full",
          sheet
            ? "max-h-[88dvh] max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[26px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2 shadow-[0_-12px_40px_rgba(58,42,40,0.2)] sm:rounded-[26px] sm:pb-6"
            : "m-4 max-w-[420px]",
          settling && "transition-transform duration-300 ease-out",
        )}
        style={
          sheet && (dy || liftY)
            ? {
                transform: `translateY(${dy - liftY}px)`,
                ...(liftY ? { maxHeight: `calc(100dvh - ${liftY}px)` } : {}),
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        {sheet ? (
          <>
            <div
              className="-mx-5 -mt-2 touch-none px-5 pb-1 pt-2"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <div className="mx-auto mb-3 mt-1.5 h-[5px] w-10 cursor-grab rounded-full bg-border active:cursor-grabbing" />
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Fechar"
              className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="press-sm -ml-1 mb-1 inline-flex items-center gap-0.5 rounded-full py-1 pl-1 pr-2 text-sm font-bold text-primary"
              >
                <ChevronLeft className="size-4" /> {backLabel}
              </button>
            ) : null}
            {title ? (
              <h3 className="font-display text-[22px] font-extrabold leading-tight text-foreground">
                {title}
              </h3>
            ) : null}
          </>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
