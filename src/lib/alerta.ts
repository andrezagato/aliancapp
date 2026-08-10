"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * ALERTA DE MENSAGEM — som, tremida e o pisca da tela.
 *
 * Existe por uma decisão de operação: o chat do Sirvo passa a ser a via oficial
 * entre a Produção (no palco) e a cabine técnica (no fundo). Uma via de
 * comunicação que depende de alguém OLHAR pra tela não é uma via — é sorte. Daí
 * três camadas, e nenhuma delas sozinha resolve:
 *
 *  1. SOM. O aviso que funciona com a cabine de costas pro monitor.
 *  2. VISUAL QUE NÃO SOME. Cabine de igreja é lugar barulhento — retorno, PA,
 *     banda. Quando o som morre no meio da mixagem, quem avisa é a tela; e um
 *     toast de 4 segundos falha exatamente no caso que importa, o operador que
 *     saiu da mesa por vinte segundos. Então o alerta FICA até alguém olhar.
 *  3. REPIQUE. Sem resposta, o som volta a cada 15s por 4 vezes e depois cala.
 *     Escalar é o que transforma "devia ter visto" em "vi". Calar depois é o que
 *     impede o apito de virar barulho de fundo, que é como um alerta morre.
 *
 * A TRAVA DO NAVEGADOR, que manda no desenho: navegador nenhum toca áudio antes
 * de a pessoa interagir com a página. Uma régia que abre a tela e não clica em
 * nada fica MUDA — e ninguém descobre isso até a mensagem que importava passar
 * batido. Por isso o som tem estado visível e a liberação é um gesto explícito
 * (ver `useSomDeAlerta`): enquanto o áudio não está de pé, a tela diz isso com
 * todas as letras em vez de mentir que está protegida.
 */

/** Preferência do APARELHO, não da conta: a régia é um PC compartilhado. */
const CHAVE = "sirvo:alerta:som";

/** Quantas vezes o som volta quando ninguém reage, e de quanto em quanto. */
export const REPIQUES = 4;
export const REPIQUE_MS = 15_000;

/** Régia grita; celular no bolso avisa. */
export const VOL_REGIA = 0.5;
export const VOL_CELULAR = 0.18;

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Uma nota. Envelope com ataque de 12ms e queda exponencial: sem o ataque o
 * alto-falante estala (o famoso "click" de quem liga um oscilador em ganho
 * cheio), e sem a queda o bipe soa como um teste de emergência.
 */
function nota(c: AudioContext, freq: number, quando: number, dur: number, vol: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  // `triangle` e não `sine`: precisa de harmônico pra atravessar retorno de
  // palco e PA. Senoide pura é a primeira coisa que a mixagem engole.
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, quando);
  g.gain.linearRampToValueAtTime(vol, quando + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(quando);
  osc.stop(quando + dur + 0.02);
}

/**
 * O apito de mensagem nova: duas notas subindo (Sol5 → Ré6). Subir é o que soa
 * como "olha aqui" — descer soa como erro, e mensagem de chat não é erro.
 *
 * Sintetizado em vez de arquivo de propósito: nada pra baixar, nada pra falhar
 * no wi-fi da igreja, nada de binário no repositório. Se o áudio não está de pé,
 * devolve `false` — quem chamou usa isso pra pedir a liberação em vez de achar
 * que avisou.
 */
export function tocarAlerta(vol = VOL_REGIA): boolean {
  const c = contexto();
  if (!c || c.state !== "running") return false;
  const t = c.currentTime + 0.01;
  nota(c, 784, t, 0.13, vol);
  nota(c, 1175, t + 0.14, 0.17, vol);
  return true;
}

/** Confirmação de que o som está de pé — uma nota só, mais baixa. */
function tocarConfirmacao(vol: number) {
  const c = contexto();
  if (!c || c.state !== "running") return;
  nota(c, 988, c.currentTime + 0.01, 0.12, vol * 0.8);
}

/** Tremida curta. Só Android por navegador; iOS ignora sem reclamar. */
export function vibrar() {
  try {
    navigator.vibrate?.([60, 45, 60]);
  } catch {
    /* aparelho sem vibração — o som e o visual seguem */
  }
}

// --- O pisca da tela ---------------------------------------------------------
//
// Barramento de módulo em vez de contexto do React porque quem PISCA e quem
// RECEBE a mensagem são irmãos na árvore: em /control o chat e o quadro da sala
// entram como slots montados no servidor, e não há pai comum do lado do cliente
// pra pendurar um provider sem reestruturar a página.

const ouvintes = new Set<() => void>();

export function emitirFlash() {
  for (const fn of ouvintes) fn();
}

/**
 * 0 = apagado; n > 0 = acesa a n-ésima piscada, por 2,5s (o tempo de um olhar
 * cruzar a sala).
 *
 * Contador e não booleano de propósito: com booleano, a segunda mensagem que
 * chega DURANTE a piscada não reinicia a animação (o valor já era `true`), e a
 * moldura seguia o resto do ciclo como se nada tivesse chegado. O número serve de
 * `key` no elemento, que remonta e recomeça a batida — duas mensagens, duas
 * piscadas.
 */
export function useFlashDeAlerta(): number {
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    let timer: number | null = null;
    const fn = () => {
      setPulso((p) => p + 1);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setPulso(0), 2500);
    };
    ouvintes.add(fn);
    return () => {
      ouvintes.delete(fn);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  return pulso;
}

// --- Preferência + liberação -------------------------------------------------

export type EstadoSom = {
  /** A pessoa quer som neste aparelho. */
  ligado: boolean;
  /** O navegador já deixou o áudio de pé. Sem isto, `ligado` é promessa vazia. */
  pronto: boolean;
  /** Liga (liberando o áudio no gesto) ou desliga. */
  alternar: () => void;
  /** Só libera o áudio, sem mexer na preferência — pro clique "liberar som". */
  liberar: () => void;
};

/**
 * Nasce LIGADO. Alerta que precisa ser descoberto pra existir não protege
 * ninguém, e a razão de ser desta frente é a cabine não perder mensagem. Quem
 * não quiser desliga num toque, e a escolha fica no aparelho.
 */
export function useSomDeAlerta(vol = VOL_REGIA): EstadoSom {
  const [ligado, setLigado] = useState(true);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      setLigado(localStorage.getItem(CHAVE) !== "0");
    } catch {
      /* sem localStorage: vale o padrão desta sessão */
    }
  }, []);

  const sincronizar = useCallback(() => {
    const c = contexto();
    setPronto(!!c && c.state === "running");
  }, []);

  const liberar = useCallback(() => {
    const c = contexto();
    if (!c) return;
    void c
      .resume()
      .then(() => {
        sincronizar();
        // Confirmação audível: é a única prova de que a liberação pegou.
        tocarConfirmacao(vol);
      })
      .catch(sincronizar);
  }, [sincronizar, vol]);

  // Tentativa silenciosa: muita gente já clicou em algo antes de a mensagem
  // chegar (trocou de canal, mexeu na URL do vídeo). Se o navegador aceitar,
  // ótimo; se não, o botão âmbar continua na tela pedindo o gesto.
  useEffect(() => {
    if (!ligado) return;
    sincronizar();
    const aoInteragir = () => {
      const c = contexto();
      if (!c) return;
      void c.resume().then(sincronizar).catch(() => {});
    };
    document.addEventListener("pointerdown", aoInteragir);
    document.addEventListener("keydown", aoInteragir);
    return () => {
      document.removeEventListener("pointerdown", aoInteragir);
      document.removeEventListener("keydown", aoInteragir);
    };
  }, [ligado, sincronizar]);

  const alternar = useCallback(() => {
    const proximo = !ligado;
    setLigado(proximo);
    try {
      localStorage.setItem(CHAVE, proximo ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!proximo) return;
    // Ligou: libera E toca a confirmação. "Som ligado" sem som audível é
    // exatamente o tipo de promessa que só se descobre falsa no pior momento.
    const c = contexto();
    if (!c) return;
    void c
      .resume()
      .then(() => {
        sincronizar();
        tocarConfirmacao(vol);
      })
      .catch(sincronizar);
  }, [ligado, sincronizar, vol]);

  return { ligado, pronto, alternar, liberar };
}
