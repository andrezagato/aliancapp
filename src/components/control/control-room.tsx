"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Link2, X, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SALA DE CONTROLE (/control) — uma tela só, pra um monitor 16:9 durante o culto.
 *
 *   ┌──────────────────────────────┬───────────────┐
 *   │            VÍDEO             │               │
 *   │          (2/3 largura,       │    ROTEIRO    │
 *   │         2/3 da altura)       │   (1/3, tela  │
 *   ├──────────────────────────────┤    inteira)   │
 *   │             CHAT             │               │
 *   └──────────────────────────────┴───────────────┘
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

type Modo = "iframe" | "video" | "srt" | "vazio";

function detectar(url: string): Modo {
  const u = url.trim();
  if (!u) return "vazio";
  if (/^srt:\/\//i.test(u)) return "srt";
  if (/\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(u)) return "video";
  return "iframe";
}

export function ControlRoom({
  eventoTitulo,
  quando,
  rundownSlot,
  chatSlot,
}: {
  eventoTitulo: string;
  quando: string;
  rundownSlot: React.ReactNode;
  chatSlot: React.ReactNode;
}) {
  const [url, setUrl] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [cheio, setCheio] = useState(false);

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

  const modo = detectar(url);

  return (
    <div className="grid min-h-dvh w-full grid-cols-1 gap-2 bg-background p-2 max-lg:auto-rows-[minmax(18rem,auto)] lg:h-dvh lg:grid-cols-[2fr_1fr] lg:grid-rows-1">
      {/* ------------------------------------------------ coluna do vídeo + chat */}
      <div className={cn("grid min-h-0 gap-2", cheio ? "grid-rows-1" : "grid-rows-[2fr_1fr]")}>
        <section className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-[hsl(var(--foreground))] shadow-soft">
          {modo === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} autoPlay muted controls playsInline className="h-full w-full bg-black object-contain" />
          ) : modo === "iframe" ? (
            <iframe
              src={url}
              title="Transmissão do culto"
              allow="autoplay; fullscreen; picture-in-picture"
              className="h-full w-full border-0 bg-black"
            />
          ) : (
            <div className="grid h-full place-items-center px-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10 text-white">
                  <MonitorPlay className="size-7" />
                </span>
                <p className="mt-3 font-display text-xl font-extrabold text-white">
                  {modo === "srt" ? "SRT não toca no navegador" : "Sem transmissão configurada"}
                </p>
                <p className="mt-1 text-sm leading-snug text-white/70">
                  {modo === "srt" ? (
                    <>
                      SRT é transporte UDP — o navegador não abre. Aponte um relay (MediaMTX, OBS + servidor
                      local) pro seu SRT e cole aqui a URL que ele publica: a página do player WebRTC (latência
                      abaixo de 1s) ou um <code>.m3u8</code> de HLS.
                    </>
                  ) : (
                    <>
                      Cole a URL do player da régia — a página WebRTC do seu relay, um <code>.m3u8</code>, ou
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
              aria-label={cheio ? "Mostrar o chat" : "Vídeo em tela cheia"}
              title={cheio ? "Mostrar o chat" : "Vídeo em tela cheia"}
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
                placeholder="http://192.168.0.10:8889/culto  ·  http://.../stream.m3u8"
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

        {/* -------------------------------------------------------------- chat */}
        {cheio ? null : (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card px-3 pb-3 pt-2 shadow-soft">
            {chatSlot}
          </section>
        )}
      </div>

      {/* ---------------------------------------------------------- roteiro */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <header className="shrink-0 border-b border-border bg-primary/[0.06] px-4 py-2.5">
          <p className="truncate font-display text-[17px] font-extrabold leading-tight">{eventoTitulo}</p>
          <p className="truncate text-[12.5px] capitalize text-muted-foreground">{quando}</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{rundownSlot}</div>
      </aside>
    </div>
  );
}
