"use client";

import { useEffect, useState } from "react";

/**
 * Acompanha o VisualViewport pra lidar com o teclado virtual no iOS.
 *
 * No iOS Safari/PWA o teclado NÃO encolhe o layout viewport (`100dvh`/`vh`
 * seguem cheios) — ele só cobre a parte de baixo. Elementos `position: fixed`
 * ancorados embaixo (como o bottom sheet do chat) ficam atrás do teclado, e às
 * vezes o Safari rola a área visível, às vezes não — daí o bug intermitente de
 * o teclado sobrepor o campo de texto.
 *
 * `keyboard` = quantos px o teclado está cobrindo por baixo (0 = fechado).
 * `viewportHeight` = altura realmente visível no momento (null antes de medir
 * ou quando a API não existe — Android/desktop seguem no comportamento padrão).
 */
export function useVisualViewport(): { keyboard: number; viewportHeight: number | null } {
  const [keyboard, setKeyboard] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Ignora variações pequenas (barra de endereço do Safari, jitter).
      setKeyboard(kb > 80 ? kb : 0);
      setViewportHeight(vv.height);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return { keyboard, viewportHeight };
}
