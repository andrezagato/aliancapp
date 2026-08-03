"use client";

import { useEffect } from "react";
import { sincronizarPush } from "@/lib/push-client";

/**
 * Componente sem UI, montado no shell do app: reconcilia a inscrição de push
 * deste aparelho a cada carregamento.
 *
 * Por que no shell e não no perfil: o `PushSetup` (o botão) vive só em
 * `/perfil`, tela que quase ninguém abre depois do primeiro dia. Um
 * auto-conserto ali curaria apenas quem fosse até lá — ou seja, ninguém.
 *
 * Nunca pede permissão nem mostra nada: se a pessoa não concedeu, `sincronizarPush`
 * sai fora na primeira checagem.
 */
/**
 * Uma vez por CARREGAMENTO. Módulo-nível de propósito, não `sessionStorage`:
 * aquele sobrevive ao reload e só morre quando a aba fecha, então um PWA aberto
 * por dias nunca reconciliaria — exatamente a janela em que a inscrição morre.
 * Um flag de módulo zera a cada carga de página e ainda barra a 2ª execução do
 * efeito no StrictMode.
 */
let jaSincronizou = false;

export function PushSync() {
  useEffect(() => {
    if (jaSincronizou) return;
    jaSincronizou = true;
    void sincronizarPush();
  }, []);

  return null;
}
