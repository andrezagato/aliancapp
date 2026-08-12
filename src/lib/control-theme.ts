"use client";

import { useEffect, useState } from "react";

/**
 * Tema da régia (`/control`) — escopo LOCAL, só ali (Fase 7.4 do pós-audit). Do
 * APARELHO, não da conta, mesma lógica de `sirvo:control:stream`/`:fonte`.
 *
 * `ControlRoom` e `RundownColumns` precisam ler o mesmo valor, mas um chega
 * pronto como `rundownSlot` (children já montado em `control/page.tsx`) — não
 * dá pra passar prop de um pra outro. Os dois leem o MESMO localStorage e se
 * avisam por um evento na `window`, porque o evento nativo `storage` não
 * dispara na própria aba que escreveu.
 */
const CHAVE_TEMA = "sirvo:control:tema";
const EVENTO_TEMA = "sirvo:control:tema-mudou";

export function useControlTheme(): ["claro" | "escuro", () => void] {
  const [tema, setTema] = useState<"claro" | "escuro">("claro");

  useEffect(() => {
    const ler = () => {
      try {
        setTema(localStorage.getItem(CHAVE_TEMA) === "escuro" ? "escuro" : "claro");
      } catch {
        /* sem localStorage: fica claro */
      }
    };
    ler();
    window.addEventListener(EVENTO_TEMA, ler);
    return () => window.removeEventListener(EVENTO_TEMA, ler);
  }, []);

  const alternar = () => {
    setTema((atual) => {
      const novo = atual === "escuro" ? "claro" : "escuro";
      try {
        localStorage.setItem(CHAVE_TEMA, novo);
      } catch {
        /* vale só nesta renderização */
      }
      window.dispatchEvent(new Event(EVENTO_TEMA));
      return novo;
    });
  };

  return [tema, alternar];
}
