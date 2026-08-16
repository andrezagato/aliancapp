"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Link2, X, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlashDeAlerta } from "@/lib/alerta";
import { useControlTheme } from "@/lib/control-theme";

/**
 * SALA DE CONTROLE (/control) — uma tela só, pra um monitor 16:9 durante o culto.
 *
 *   ┌──────────────────────────────┬───────────────┐
 *   │            VÍDEO             │     CHAT      │
 *   │                              │               │
 *   ├──────────────────────────────┴───────────────┤
 *   │                  ROTEIRO                     │
 *   │        (largura INTEIRA da tela, em grade)    │
 *   └──────────────────────────────────────────────┘
 *
 * O roteiro atravessa a tela inteira porque agora é uma GRADE: cada bloco é uma
 * linha e cada informação tem sua coluna (início, fim, duração, responsável,
 * observação). Foi a largura que destravou isso — na coluna de 2/3 as colunas
 * não caberiam, e é por isso que o chat desceu pra dividir a faixa de cima com
 * o vídeo em vez de ocupar a altura toda.
 *
 * As duas proporções (vídeo|chat e faixa|roteiro) são arrastáveis — Fase 7.1 do
 * pós-audit — porque salas diferem em quanto chat cabe sem apertar o vídeo.
 * Vira dimensão em PIXEL (não fr) assim que alguém arrasta, guardada no
 * APARELHO; solta o `fr` original de novo com duplo clique. Duas grades
 * (`lg:grid-rows-[...]`/`lg:grid-cols-[...]`) fazem por CSS var o que teria que
 * ser JS: sem arrasto, cai no fallback proporcional; com arrasto, a var some do
 * `style` e volta pro fallback.
 *
 * Não entra no menu de propósito: é um endereço que se digita, pro operador da
 * régia. Sem barra de navegação, sem rolagem na página — cada painel rola
 * sozinho, porque numa régia a tela não se mexe.
 *
 * SOBRE O SRT: navegador nenhum toca SRT — é transporte UDP, e o <video> fala
 * HLS, WebRTC, MP4 e pouco mais. O caminho normal é um relay (MediaMTX, por
 * exemplo) que recebe o SRT da rede local e republica em WebRTC (latência de
 * menos de 1s) ou HLS. É a URL DESSE relay que entra aqui — por isso o campo
 * aceita tanto uma página de player (vai em iframe) quanto um arquivo/stream
 * direto (vai no <video>).
 */
const CHAVE_URL = "sirvo:control:stream";
const CHAVE_SPLIT_X = "sirvo:control:split-x";
const CHAVE_SPLIT_Y = "sirvo:control:split-y";
/** Larguras/alturas em px — Fase 7.1. Os limites existem pra um arraste
 * distraído não engolir um painel no meio do culto. */
const CHAT_MIN = 280;
const CHAT_MAX = 620;
/** Precisa bater com o `380px` cravado na classe `lg:grid-cols-[...]` abaixo —
 * é o fallback de ANTES do primeiro arraste, quando ainda não há valor salvo. */
const CHAT_PADRAO = 380;
const ROTEIRO_MIN = 220;
/** `gap-2` = 0.5rem = 8px; a raiz da régia não muda de font-size (só o roteiro,
 * dentro do seu próprio `<div style={{fontSize}}>`), então é seguro cravar. */
const GAP_PX = 8;
const HANDLE_PX = 10;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Modo = "iframe" | "video" | "srt" | "inseguro" | "vazio";

function detectar(url: string): Modo {
  const u = url.trim();
  if (!u) return "vazio";
  if (/^srt:\/\//i.test(u)) return "srt";
  // O app roda em HTTPS; um endereço http:// (o típico relay da rede local) é
  // BLOQUEADO pelo navegador como conteúdo misto — e sem aviso nenhum, só fica
  // preto. Melhor dizer isso do que deixar a régia adivinhando.
  if (typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\//i.test(u)) {
    return "inseguro";
  }
  if (/\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(u)) return "video";
  return "iframe";
}

/** Divisória arrastável — vertical (vídeo|chat) ou horizontal (faixa|roteiro).
 * Arraste vira delta em px; duplo clique solta pro `fr` original; com foco, as
 * setas movem 16px por toque. */
function Divisoria({
  orientacao,
  aria,
  onMover,
  onReset,
}: {
  orientacao: "vertical" | "horizontal";
  aria: string;
  onMover: (delta: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<number | null>(null);
  const vertical = orientacao === "vertical";
  return (
    <div
      role="separator"
      aria-orientation={orientacao}
      aria-label={aria}
      tabIndex={0}
      onPointerDown={(e) => {
        drag.current = vertical ? e.clientX : e.clientY;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current == null) return;
        const atual = vertical ? e.clientX : e.clientY;
        const delta = atual - drag.current;
        drag.current = atual;
        onMover(delta);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (vertical && e.key === "ArrowLeft") onMover(-16);
        else if (vertical && e.key === "ArrowRight") onMover(16);
        else if (!vertical && e.key === "ArrowUp") onMover(-16);
        else if (!vertical && e.key === "ArrowDown") onMover(16);
      }}
      className={cn(
        "group hidden shrink-0 touch-none place-items-center rounded-full outline-none focus-visible:bg-primary/10 lg:grid",
        vertical ? "w-2 cursor-col-resize" : "h-2 w-full cursor-row-resize",
      )}
    >
      <span
        className={cn(
          "rounded-full bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary",
          vertical ? "h-10 w-[3px]" : "h-[3px] w-10",
        )}
      />
    </div>
  );
}

export function ControlRoom({
  rundownSlot,
  chatSlot,
}: {
  rundownSlot: React.ReactNode;
  chatSlot: React.ReactNode;
}) {
  const [url, setUrl] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [cheio, setCheio] = useState(false);
  // Mensagem nova no chat: a moldura da SALA inteira pisca. Mora aqui, e não no
  // painel do chat, porque o alerta precisa alcançar quem está de olho no vídeo
  // ou no roteiro — que é onde o operador olha 95% do culto.
  const flash = useFlashDeAlerta();
  // Tema (Fase 7.4) — só esta tela; ver src/lib/control-theme.ts pro porquê de
  // não ser um simples useState local (RundownColumns chega pronto como slot).
  const [tema] = useControlTheme();

  // Divisórias (Fase 7.1). `null` = ainda não arrastou nesta sala, usa o `fr`
  // proporcional das classes abaixo.
  const [splitX, setSplitX] = useState<number | null>(null);
  const [splitY, setSplitY] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [alturaTotal, setAlturaTotal] = useState(800);

  // A URL fica no APARELHO da régia (o PC da sala), não na conta: cada sala tem
  // o seu relay, e quem loga ali é qualquer pessoa da equipe.
  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_URL) ?? "";
      setUrl(salva);
      setRascunho(salva);
      if (!salva) setEditandoUrl(true);
    } catch {
      setEditandoUrl(true);
    }
  }, []);

  useEffect(() => {
    try {
      const x = Number(localStorage.getItem(CHAVE_SPLIT_X));
      if (x >= CHAT_MIN && x <= CHAT_MAX) setSplitX(x);
      const y = Number(localStorage.getItem(CHAVE_SPLIT_Y));
      if (y >= ROTEIRO_MIN) setSplitY(y);
    } catch {
      /* sem localStorage: fica no padrão proporcional */
    }
  }, []);

  // Altura real do container — é o que permite o limite de "70% da altura" do
  // roteiro reagir à janela de verdade, em vez de chutar `window.innerHeight`.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAlturaTotal(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function salvarUrl(valor: string) {
    const v = valor.trim();
    setUrl(v);
    setEditandoUrl(false);
    try {
      if (v) localStorage.setItem(CHAVE_URL, v);
      else localStorage.removeItem(CHAVE_URL);
    } catch {
      /* sem localStorage: vale só nesta sessão */
    }
  }

  const moverX = (dx: number) =>
    setSplitX((w) => {
      const novo = clamp((w ?? CHAT_PADRAO) - dx, CHAT_MIN, CHAT_MAX);
      try {
        localStorage.setItem(CHAVE_SPLIT_X, String(novo));
      } catch {
        /* vale só nesta renderização */
      }
      return novo;
    });
  const resetX = () => {
    setSplitX(null);
    try {
      localStorage.removeItem(CHAVE_SPLIT_X);
    } catch {}
  };
  const moverY = (dy: number) =>
    setSplitY((h) => {
      const max = Math.max(ROTEIRO_MIN, alturaTotal * 0.7);
      const base = h ?? Math.round(alturaTotal * 0.4);
      const novo = clamp(base - dy, ROTEIRO_MIN, max);
      try {
        localStorage.setItem(CHAVE_SPLIT_Y, String(novo));
      } catch {}
      return novo;
    });
  const resetY = () => {
    setSplitY(null);
    try {
      localStorage.removeItem(CHAVE_SPLIT_Y);
    } catch {}
  };

  const modo = detectar(url);

  const rowVars =
    splitY != null
      ? ({
          "--split-top": `${Math.max(0, alturaTotal - HANDLE_PX - GAP_PX * 2 - splitY)}px`,
          "--split-bottom": `${splitY}px`,
        } as React.CSSProperties)
      : undefined;
  const colVars = splitX != null ? ({ "--split-x": `${splitX}px` } as React.CSSProperties) : undefined;

  return (
    <div
      ref={gridRef}
      className={cn(
        // `text-foreground` junto do `bg-background` NÃO é redundância: a classe
        // `.dark` troca as VARIÁVEIS, não a cor já computada. O `body` declara
        // `text-foreground` no tema claro, e todo texto daqui de dentro que não
        // tem classe de cor própria — o título do bloco, por exemplo — herdava
        // aquela tinta escura e sumia no carvão. Declarar a cor DENTRO do escopo
        // `.dark` é o que faz a herança resolver pelo token certo.
        "grid min-h-dvh w-full grid-cols-1 gap-2 bg-background p-2 text-foreground max-lg:auto-rows-[minmax(18rem,auto)] lg:h-dvh lg:grid-cols-1",
        cheio ? "lg:grid-rows-1" : "lg:grid-rows-[var(--split-top,3fr)_10px_var(--split-bottom,2fr)]",
        tema === "escuro" && "dark",
      )}
      style={rowVars}
    >
      {/* --------------------------------------- faixa de cima: vídeo | chat */}
      <div
        className="grid min-h-0 gap-2 lg:grid-cols-[minmax(0,1fr)_8px_var(--split-x,380px)] lg:grid-rows-1"
        style={colVars}
      >
        <section className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-[hsl(var(--foreground))] shadow-soft">
          {modo === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} autoPlay muted controls playsInline className="h-full w-full bg-black object-contain" />
          ) : modo === "iframe" ? (
            /* VDO.Ninja e players WebRTC precisam da permissão explícita do pai;
               sem `autoplay` o vídeo entra pausado e ninguém entende por quê. */
            <iframe
              src={url}
              title="Transmissão do culto"
              allow="autoplay; fullscreen; picture-in-picture; camera; microphone; display-capture; speaker-selection"
              allowFullScreen
              className="h-full w-full border-0 bg-black"
            />
          ) : (
            <div className="grid h-full place-items-center px-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10 text-white">
                  <MonitorPlay className="size-7" />
                </span>
                <p className="mt-3 font-display text-xl font-extrabold text-white">
                  {modo === "srt"
                    ? "SRT não toca no navegador"
                    : modo === "inseguro"
                      ? "Endereço http:// é bloqueado aqui"
                      : "Sem transmissão configurada"}
                </p>
                <p className="mt-1 text-sm leading-snug text-white/70">
                  {modo === "srt" ? (
                    <>
                      SRT é transporte UDP — o navegador não abre. Aponte um relay (MediaMTX, OBS + servidor
                      local) pro seu SRT e cole aqui a URL que ele publica: a página do player WebRTC (latência
                      abaixo de 1s) ou um <code>.m3u8</code> de HLS.
                    </>
                  ) : modo === "inseguro" ? (
                    <>
                      Esta página é HTTPS, então o navegador recusa carregar conteúdo <code>http://</code> —
                      inclusive o relay da rede local. Use uma URL <code>https://</code> (o VDO.Ninja já é) ou
                      exponha o relay com certificado.
                    </>
                  ) : (
                    <>
                      Cole a URL do player — o link de visualização do <strong>VDO.Ninja</strong>{" "}
                      (<code>vdo.ninja/?view=…</code>), a página WebRTC de um relay, um <code>.m3u8</code>, ou
                      qualquer página que já mostre o vídeo.
                    </>
                  )}
                </p>
                <button
                  onClick={() => setEditandoUrl(true)}
                  className="press mt-4 inline-flex h-11 items-center gap-2 rounded-[14px] bg-white px-4 text-[15px] font-bold text-foreground"
                >
                  <Link2 className="size-4" /> {url ? "Trocar a URL" : "Colar a URL"}
                </button>
              </div>
            </div>
          )}

          {/* controles flutuantes: só aparecem no hover, pra não sujar a imagem */}
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
            <button
              onClick={() => setEditandoUrl(true)}
              aria-label="Trocar a URL da transmissão"
              title="Trocar a URL da transmissão"
              className="press-sm grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
            >
              <Link2 className="size-4" />
            </button>
            <button
              onClick={() => setCheio((v) => !v)}
              aria-label={cheio ? "Mostrar o roteiro" : "Só o vídeo"}
              title={cheio ? "Mostrar o roteiro" : "Só o vídeo"}
              className="press-sm grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
            >
              {cheio ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>

          {editandoUrl ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-white/10 bg-black/80 p-2 backdrop-blur">
              <input
                autoFocus
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarUrl(rascunho);
                  if (e.key === "Escape") setEditandoUrl(false);
                }}
                placeholder="https://vdo.ninja/?view=SEUCODIGO&cleanoutput  ·  https://.../stream.m3u8"
                className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                onClick={() => salvarUrl(rascunho)}
                className="press-sm h-9 rounded-xl bg-white px-3 text-sm font-bold text-foreground"
              >
                Usar
              </button>
              <button
                onClick={() => setEditandoUrl(false)}
                aria-label="Cancelar"
                className="press-sm grid size-9 place-items-center rounded-xl text-white/70"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
        </section>

        <Divisoria orientacao="vertical" aria="Redimensionar o chat" onMover={moverX} onReset={resetX} />

        {/* -------------------------------------------------------------- chat */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card px-3 pb-3 pt-2 shadow-soft">
          {chatSlot}
        </aside>
      </div>

      {/* A moldura do alerta. `pointer-events-none` é obrigatório: numa régia,
          uma camada que engole clique por 2,5s no meio do culto seria pior que
          perder a mensagem. `key` remonta o elemento a cada piscada pra
          reiniciar a animação quando duas mensagens chegam em sequência. */}
      {flash > 0 ? (
        <span
          key={flash}
          aria-hidden
          className="animate-alerta pointer-events-none fixed inset-0 z-50 shadow-[inset_0_0_0_5px_hsl(var(--primary)),inset_0_0_28px_6px_hsl(var(--primary)/0.35)]"
        />
      ) : null}

      {cheio ? null : (
        <>
          <Divisoria orientacao="horizontal" aria="Redimensionar o roteiro" onMover={moverY} onReset={resetY} />

          {/* ------------------------------- roteiro: a largura INTEIRA da tela */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {/* Sem cabeçalho aqui: título, data, contadores e controles vivem numa
                BARRA SÓ, dentro da própria grade — duas faixas quase vazias
                empilhadas comiam altura que a régia não tem pra dar. */}
            {/* `overflow-auto` e não `overflow-y-auto`: a grade tem largura mínima
                e precisa poder rolar na horizontal em vez de espremer as colunas */}
            <div className="min-h-0 flex-1 overflow-auto p-3">{rundownSlot}</div>
          </section>
        </>
      )}
    </div>
  );
}
