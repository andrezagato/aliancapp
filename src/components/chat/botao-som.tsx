"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoSom } from "@/lib/alerta";

/**
 * O interruptor do som do aparelho — e, mais importante, o AVISO de que ele não
 * está de pé.
 *
 * Três estados, e o do meio é a razão de o botão existir:
 *
 *  · desligado ..... ícone riscado, discreto. Escolha da pessoa, respeitada.
 *  · TRAVADO ....... âmbar, com a palavra "Liberar som" escrita. O navegador não
 *                    toca áudio antes de um gesto, então este é o estado real de
 *                    toda régia que acabou de abrir a tela. Sem esta faixa âmbar
 *                    a cabine acharia que está protegida e estaria muda.
 *  · ligado ........ ícone normal, sem texto. Não precisa gritar quem já está ok.
 *
 * Volume e não campainha de propósito: o sino ao lado, dentro da conversa,
 * silencia AQUELE canal pra todo mundo naquela conta. Este mexe no som DESTE
 * aparelho. Dois sinos iguais fariam a pessoa desligar a coisa errada.
 */
export function BotaoSom({
  estado,
  em,
  className,
}: {
  estado: EstadoSom;
  /** A régia dimensiona tudo em `em` (fonte ajustável da sala). */
  em?: boolean;
  className?: string;
}) {
  const { ligado, pronto, alternar, liberar } = estado;
  const travado = ligado && !pronto;

  return (
    <button
      type="button"
      onClick={travado ? liberar : alternar}
      aria-label={
        travado
          ? "Liberar o som do alerta neste aparelho"
          : ligado
            ? "Desligar o som do alerta neste aparelho"
            : "Ligar o som do alerta neste aparelho"
      }
      title={
        travado
          ? "O navegador só toca som depois de um toque na página. Toque aqui pra liberar."
          : ligado
            ? "Som do alerta ligado neste aparelho"
            : "Som do alerta desligado neste aparelho"
      }
      className={cn(
        "press-sm inline-flex shrink-0 items-center gap-1.5 rounded-full border font-extrabold",
        em ? "h-[2.1em] gap-[0.35em] px-[0.6em] text-[0.72em]" : "h-8 px-2.5 text-[12px]",
        travado
          ? "animate-pulse border-warning/50 bg-warning/15 text-warning-ink"
          : ligado
            ? "border-border text-muted-foreground"
            : "border-transparent text-muted-foreground/60",
        className,
      )}
    >
      {ligado ? (
        <Volume2 className={em ? "size-[1.3em]" : "size-4"} />
      ) : (
        <VolumeX className={em ? "size-[1.3em]" : "size-4"} />
      )}
      {travado ? "Liberar som" : null}
    </button>
  );
}
