"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, MonitorDot, X, Plus, Trash2, Settings2, Send } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import type { ActionResult } from "@/lib/types";
import {
  enviarStageMessage,
  limparStageMessage,
  salvarAtalhoStage,
  removerAtalhoStage,
} from "@/lib/actions";

/**
 * MONITOR DE PALCO — o que a Produção fala com quem está no palco.
 *
 * O app escreve, a ponte (ponte-propresenter/) entrega ao ProPresenter via
 * `stageDisplaySendMessage`. Migration 0050.
 *
 * Chamava-se "telão" e o ícone era uma bolha de conversa. As duas coisas
 * mentiam: telão é a tela que a IGREJA vê, e isto é o monitor de retorno que só
 * quem está no palco lê; bolha de conversa é o símbolo do chat, que fica ao lado
 * — quem via os dois juntos entendia "dois chats". Nome e símbolo agora dizem o
 * que a coisa é: um MONITOR, com um ponto quando tem algo no ar.
 *
 * Duas regras de desenho que valem explicar, porque parecem detalhe e não são:
 *
 * 1. QUANDO APAGADO, ISTO NÃO OCUPA ESPAÇO. O acesso é um ícone junto dos
 *    outros do cabeçalho; a FAIXA só existe quando há mensagem no ar. Uma faixa
 *    permanente dizendo "nada no monitor" seria ruído nas 99% do tempo em que não
 *    há nada — e ruído constante é o que faz ninguém enxergar o aviso quando
 *    ele finalmente importa.
 *
 * 2. QUANDO ACESO, É IMPOSSÍVEL DE NÃO VER, e some sozinho. Mensagem esquecida
 *    morando no monitor do pregador é o pior estado possível, então: faixa âmbar
 *    com o texto, o autor, a contagem do que resta, e um ✕ que tira dali mesmo
 *    — sem abrir nada. A expiração é obrigatória (1/3/10 min, migration 0050).
 *
 * O toque num atalho MANDA na hora, não preenche o campo: sob pressão, dois
 * toques é um toque demais. Quem se arrepender tem o "Tirar do monitor" logo ali.
 */

export type StageMsg = {
  id: string;
  texto: string;
  autor: string | null;
  expiresAt: string;
};

export type StageAtalho = { id: string; label: string };

export const STAGE_MAX_ATALHOS = 6;
const MAX_TEXTO = 120;
const MINUTOS = [1, 3, 10] as const;

/** Cronômetro do que resta — em segundos, porque a faixa é sobre urgência. */
function useRestante(expiresAt: string | null): number {
  const [restante, setRestante] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const alvo = new Date(expiresAt).getTime();
    const tick = () => setRestante(Math.max(0, alvo - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return restante;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** O ícone de acesso. Fica âmbar quando há mensagem no ar — sinal de graça. */
export function StageMessageButton({
  ligado,
  onClick,
  em,
}: {
  ligado: boolean;
  onClick: () => void;
  /** A régia dimensiona tudo em `em` (fonte ajustável da sala); o celular, em px. */
  em?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ligado ? "Mensagem no monitor de palco (ligada)" : "Mandar mensagem ao monitor de palco"}
      title={ligado ? "Mensagem no monitor de palco (ligada)" : "Mandar mensagem ao monitor de palco"}
      className={cn(
        "press-sm grid shrink-0 place-items-center rounded-full border",
        em ? "size-[2.4em]" : "size-9",
        ligado
          ? "border-warning/40 bg-warning/12 text-warning-ink"
          : "border-border text-muted-foreground",
      )}
    >
      {/* O ponto no monitor diz "tem algo no ar" em FORMA, não só em cor —
          mesma regra do ponto pulsando do "ao vivo". */}
      {ligado ? (
        <MonitorDot className={em ? "size-[1.1em]" : "size-4"} />
      ) : (
        <Monitor className={em ? "size-[1.1em]" : "size-4"} />
      )}
    </button>
  );
}

/**
 * A faixa "no monitor agora". Mesma peça no celular e na régia — duas versões
 * divergiriam, e esta é justamente a informação que não pode discordar entre
 * a tela de quem manda e a tela de quem confere.
 */
export function StageMessageStrip({
  msg,
  eventId,
  podeMexer,
  onAbrir,
  em,
}: {
  msg: StageMsg;
  eventId: string;
  podeMexer: boolean;
  onAbrir: () => void;
  /** A régia dimensiona tudo em `em` (fonte ajustável da sala); o celular, em px. */
  em?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pendente, startTx] = useTransition();
  const restante = useRestante(msg.expiresAt);

  // Expirou com a tela aberta: o servidor já não devolve mais esta mensagem, mas
  // ninguém recarregou. Puxa uma vez pra faixa sumir junto com o monitor.
  useEffect(() => {
    if (restante === 0 && msg.expiresAt) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante === 0]);

  const limpar = () =>
    startTx(async () => {
      const r = await limparStageMessage(eventId);
      if (!r.ok) showToast(r.error);
      else router.refresh();
    });

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-warning/12 text-warning-ink",
        em ? "px-[0.8em] py-[0.35em]" : "px-3 py-1.5",
      )}
    >
      <span className={cn("shrink-0 animate-pulse rounded-full bg-warning", em ? "size-[0.5em]" : "size-2.5")} />
      <span className={cn("shrink-0 font-extrabold uppercase tracking-wide", em ? "text-[0.62em]" : "text-[11px]")}>
        no monitor
      </span>
      <button
        onClick={onAbrir}
        className={cn("min-w-0 flex-1 truncate text-left font-bold", em ? "text-[0.95em]" : "text-sm")}
      >
        {msg.texto}
      </button>
      <span
        className={cn(
          "shrink-0 tabular-nums opacity-80",
          em ? "text-[0.68em]" : "text-[11px]",
        )}
      >
        {mmss(restante)}
        {msg.autor ? ` · ${msg.autor}` : ""}
      </span>
      {podeMexer ? (
        <button
          onClick={limpar}
          disabled={pendente}
          aria-label="Tirar a mensagem do monitor"
          title="Tirar a mensagem do monitor"
          className={cn(
            "press-sm grid shrink-0 place-items-center rounded-full bg-warning/20 disabled:opacity-50",
            em ? "size-[1.5em]" : "size-6",
          )}
        >
          <X className={em ? "size-[0.9em]" : "size-3.5"} />
        </button>
      ) : null}
    </div>
  );
}

/** O painel: atalhos, texto livre, tempo de vida e a gestão dos atalhos. */
export function StageMessageSheet({
  open,
  onClose,
  eventId,
  msg,
  atalhos,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  msg: StageMsg | null;
  atalhos: StageAtalho[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pendente, startTx] = useTransition();
  const [texto, setTexto] = useState("");
  const [minutos, setMinutos] = useState<number>(3);
  const [gerenciando, setGerenciando] = useState(false);
  const [novoAtalho, setNovoAtalho] = useState("");
  const restante = useRestante(msg?.expiresAt ?? null);
  const { keyboard } = useVisualViewport();

  useEffect(() => {
    if (!open) {
      setTexto("");
      setGerenciando(false);
      setNovoAtalho("");
    }
  }, [open]);

  const agir = (fn: () => Promise<ActionResult>, aoDarCerto?: () => void) =>
    startTx(async () => {
      const r = await fn();
      if (!r.ok) showToast(r.error);
      else {
        aoDarCerto?.();
        router.refresh();
      }
    });

  const enviar = (valor: string) => {
    const t = valor.trim();
    if (!t) return;
    agir(() => enviarStageMessage(eventId, t, minutos), () => setTexto(""));
  };

  const noLimite = atalhos.length >= STAGE_MAX_ATALHOS;

  return (
    <Modal open={open} onClose={onClose} sheet title="Monitor de palco" liftY={keyboard}>
      <div className="space-y-4">
        {msg ? (
          <div className="rounded-[14px] bg-warning/12 px-3 py-2.5 text-warning-ink">
            <p className="text-[11px] font-extrabold uppercase tracking-wide">No monitor agora</p>
            <p className="mt-0.5 text-[15px] font-bold leading-snug">{msg.texto}</p>
            <p className="mt-0.5 text-xs opacity-80">
              apaga em {mmss(restante)}
              {msg.autor ? ` · ${msg.autor}` : ""}
            </p>
            <button
              onClick={() => agir(() => limparStageMessage(eventId))}
              disabled={pendente}
              className="press mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-warning/20 px-3 text-[13px] font-extrabold disabled:opacity-50"
            >
              <X className="size-4" /> Tirar do monitor
            </button>
          </div>
        ) : (
          <p className="rounded-[14px] border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
            Nada no monitor agora. O que você mandar aparece no monitor de quem está no palco.
          </p>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[13px] font-bold text-muted-foreground">
              Atalhos <span className="font-normal">· toque manda na hora</span>
            </p>
            <button
              onClick={() => setGerenciando((v) => !v)}
              className="press-sm inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground"
            >
              <Settings2 className="size-3.5" /> {gerenciando ? "Pronto" : "Gerenciar"}
            </button>
          </div>

          {atalhos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atalho ainda — crie em “Gerenciar”.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {atalhos.map((a) => (
                <span key={a.id} className="inline-flex items-center">
                  <button
                    onClick={() => (gerenciando ? undefined : enviar(a.label))}
                    disabled={pendente || gerenciando}
                    className={cn(
                      "press-sm rounded-full border px-3 py-1.5 text-sm font-bold",
                      gerenciando
                        ? "border-border text-muted-foreground"
                        : "border-primary/30 bg-primary/10 text-primary disabled:opacity-50",
                    )}
                  >
                    {a.label}
                  </button>
                  {gerenciando ? (
                    <button
                      onClick={() => agir(() => removerAtalhoStage(a.id))}
                      disabled={pendente}
                      aria-label={`Apagar atalho ${a.label}`}
                      className="press-sm -ml-1 grid size-7 place-items-center rounded-full text-destructive-ink"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          )}

          {gerenciando ? (
            <div className="mt-2.5">
              <div className="flex gap-2">
                <input
                  className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder={noLimite ? "Limite de 6 atalhos" : "Ex.: Falta 1 minuto"}
                  maxLength={40}
                  disabled={noLimite}
                  value={novoAtalho}
                  onChange={(e) => setNovoAtalho(e.target.value)}
                />
                <button
                  onClick={() => agir(() => salvarAtalhoStage(novoAtalho), () => setNovoAtalho(""))}
                  disabled={pendente || noLimite || !novoAtalho.trim()}
                  className="press-sm inline-flex h-10 shrink-0 items-center gap-1 rounded-[12px] border border-border px-3 text-sm font-extrabold disabled:opacity-40"
                >
                  <Plus className="size-4" /> Add
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {atalhos.length}/{STAGE_MAX_ATALHOS} atalhos. Acima disso a pessoa lê uma lista em vez de acertar um
                botão — e aí digitar já era mais rápido.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-bold text-muted-foreground">Escrever agora</p>
          <textarea
            rows={2}
            maxLength={MAX_TEXTO}
            className="w-full resize-none rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="O que aparece no monitor do palco…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {texto.length}/{MAX_TEXTO}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              apaga em
              <span className="inline-flex overflow-hidden rounded-full border border-border">
                {MINUTOS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinutos(m)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-extrabold",
                      minutos === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </span>
              min
            </span>
          </div>
          <button
            onClick={() => enviar(texto)}
            disabled={pendente || !texto.trim()}
            className="press mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[15px] font-extrabold text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4" /> Mandar pro monitor
          </button>
        </div>
      </div>
    </Modal>
  );
}
