"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotaoSegurar } from "@/components/rundown-salvaguardas";

/**
 * MENU DO CULTO — o agrupador que tira o destrutivo da superfície.
 *
 * Ideia do André depois de testar a pressão longa no celular: um botão que abre
 * outros ao lado, e que aceita tanto TOCAR quanto DESLIZAR o dedo até a opção.
 * Ele resolve dois problemas que a pressão longa sozinha não resolvia:
 *
 *  · O RETORNO SAI DE BAIXO DO DEDO. A varredura de progresso morava dentro de
 *    um alvo de 36px, ou seja, exatamente sob o polegar — "não fica visível
 *    porque eu tô com o dedo". As opções aqui abrem PRA LONGE do ponto tocado.
 *  · O ERRO DE 09/08 ERAM DOIS TOQUES NA MESMA COORDENADA. Aqui o gatilho FICA
 *    NO LUGAR e as opções aparecem em volta — então o segundo toque no mesmo
 *    ponto acerta o gatilho de novo e só fecha o menu. Inofensivo, e sem
 *    depender de cronômetro.
 *
 * Por isso o "segurar" NÃO se repete dentro do menu: abrir, mirar e soltar num
 * alvo específico já é intenção suficiente, e exigir os dois seria cinto e
 * suspensório em cima de quem encerra culto toda semana. A exceção é o item
 * marcado `segurar` — reservado ao que não tem desfazer (reiniciar apaga os
 * tiques; encerrar, desde a 0051, tem volta).
 */

export type ItemMenuCulto = {
  id: string;
  rotulo: string;
  icone: React.ReactNode;
  /** Ação. Itens de navegação usam `href` no lugar. */
  aoEscolher?: () => void;
  /** Navegação: vira link de verdade (abre em aba nova quando `externo`). */
  href?: string;
  externo?: boolean;
  /** Telha: é o que muda o estado do culto. */
  destrutivo?: boolean;
  /** Exige pressão longa mesmo dentro do menu. */
  segurar?: boolean;
  desabilitado?: boolean;
  /** Linha miúda embaixo do rótulo — diz a consequência, não repete o rótulo. */
  detalhe?: string;
  /** Fio separando o que navega do que muda o estado do culto. */
  separadorAntes?: boolean;
};

export function MenuCulto({
  itens,
  rotulo = "Culto",
  em,
}: {
  itens: ItemMenuCulto[];
  rotulo?: string;
  /** Régia: dimensiona em `em` pra acompanhar o controle de fonte da sala. */
  em?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [focado, setFocado] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const arrastando = useRef(false);
  const vazio = itens.length === 0;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  /** Qual item está sob o dedo agora (o menu já está no DOM quando isto roda). */
  const itemSob = (x: number, y: number): string | null =>
    (document.elementFromPoint(x, y)?.closest("[data-item-menu]") as HTMLElement | null)
      ?.dataset.itemMenu ?? null;

  const aoDescerNoGatilho = (e: React.PointerEvent) => {
    // Segundo toque no MESMO ponto = fecha. É esta linha que torna o toque duplo
    // acidental inofensivo, sem precisar de carência.
    if (aberto) {
      setAberto(false);
      setFocado(null);
      return;
    }
    e.preventDefault();
    setAberto(true);
    arrastando.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const aoMover = (e: React.PointerEvent) => {
    if (!arrastando.current) return;
    setFocado(itemSob(e.clientX, e.clientY));
  };

  const aoSoltar = (e: React.PointerEvent) => {
    if (!arrastando.current) return;
    arrastando.current = false;
    const alvo = itemSob(e.clientX, e.clientY);
    setFocado(null);
    if (!alvo) return; // soltou no gatilho ou fora: menu fica aberto pro toque
    const item = itens.find((i) => i.id === alvo);
    if (!item || item.desabilitado) return;
    // Item de pressão longa não aceita deslizar: fica só destacado, e a pessoa
    // segura em seguida. Deslizar num "apaga tudo" seria fácil demais.
    if (item.segurar) return;
    // Item de navegação não dispara por deslize: seguir link sem soltar em cima
    // do texto confunde, e o link já é barato de tocar.
    if (item.href) return;
    setAberto(false);
    item.aoEscolher?.();
  };

  const escolher = (item: ItemMenuCulto) => {
    setAberto(false);
    item.aoEscolher?.();
  };

  if (vazio) return null;

  return (
    <div ref={caixa} className="relative select-none [-webkit-touch-callout:none]">
      <button
        type="button"
        onPointerDown={aoDescerNoGatilho}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={() => {
          arrastando.current = false;
          setFocado(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAberto((v) => !v);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={aberto}
        style={{ touchAction: "none" }}
        className={cn(
          "press-sm inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-extrabold",
          em && "h-[2.4em] gap-[0.4em] px-[0.9em] py-0 text-[0.9em]",
          aberto && "border-primary/40 bg-primary/10 text-primary",
        )}
      >
        {rotulo}
        <ChevronDown className={cn("size-4", em && "size-[1.1em]", aberto && "rotate-180")} />
      </button>

      {aberto ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl border border-border bg-card p-1.5 shadow-lift",
            em && "mt-[0.4em] w-[16em] rounded-[0.8em] p-[0.3em]",
          )}
        >
          {itens.map((item) => {
            const comum = cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold",
              em && "gap-[0.5em] rounded-[0.6em] px-[0.7em] py-[0.5em] text-[0.95em]",
              item.destrutivo ? "text-destructive-ink" : "text-foreground",
              item.desabilitado && "opacity-40",
              focado === item.id && (item.destrutivo ? "bg-destructive/12" : "bg-muted"),
            );
            const miolo = (
              <>
                {item.icone}
                <span className="min-w-0 flex-1">
                  {item.rotulo}
                  {item.detalhe ? (
                    <span
                      className={cn(
                        "block text-[0.78em] font-semibold text-muted-foreground",
                        em && "text-[0.8em]",
                      )}
                    >
                      {item.detalhe}
                    </span>
                  ) : null}
                </span>
              </>
            );

            const corpo = item.segurar ? (
              <BotaoSegurar
                data-item-menu={item.id}
                role="menuitem"
                aoConfirmar={() => escolher(item)}
                textoTeclado={`${item.rotulo}?`}
                desabilitado={item.desabilitado}
                className={comum}
              >
                {miolo}
              </BotaoSegurar>
            ) : item.href ? (
              // Link de verdade: cmd-clique, "abrir em nova aba" e o prefetch do
              // Next continuam funcionando — coisa que um botão com router.push
              // jogaria fora.
              <a
                href={item.href}
                {...(item.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                data-item-menu={item.id}
                role="menuitem"
                onClick={() => setAberto(false)}
                className={comum}
              >
                {miolo}
              </a>
            ) : (
              <button
                type="button"
                role="menuitem"
                data-item-menu={item.id}
                disabled={item.desabilitado}
                onClick={() => escolher(item)}
                className={comum}
              >
                {miolo}
              </button>
            );

            return (
              <div key={item.id}>
                {item.separadorAntes ? (
                  <div className={cn("mx-3 my-1.5 h-px bg-border", em && "mx-[0.7em] my-[0.3em]")} />
                ) : null}
                {corpo}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
