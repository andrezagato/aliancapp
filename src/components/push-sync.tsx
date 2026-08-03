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
export function PushSync() {
  useEffect(() => {
    // Uma vez por aba: o efeito roda no carregamento (não a cada navegação,
    // porque o layout não remonta), e uma trava evita repetir num Fast Refresh.
    const marca = "push-sync-feito";
    try {
      if (sessionStorage.getItem(marca)) return;
      sessionStorage.setItem(marca, "1");
    } catch {
      /* modo privado sem sessionStorage: segue, só perde a trava */
    }
    void sincronizarPush();
  }, []);

  return null;
}
