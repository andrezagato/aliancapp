"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Square,
  RotateCcw,
  Check,
  Minus,
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { warm } from "@/lib/toasts";
import {
  iniciarCronograma,
  reiniciarCronograma,
  encerrarCronograma,
  reabrirCronograma,
  marcarBlocoFeito,
  reordenarCronograma,
  removerBlocoCronograma,
} from "@/lib/actions";
import { BlocoModal } from "@/components/rundown-grid";
import {
  StageMessageButton,
  StageMessageSheet,
  StageMessageStrip,
  type StageAtalho,
  type StageMsg,
} from "@/components/stage-message";
import type { RundownItem, RundownKind } from "@/lib/data";
import type { ActionResult } from "@/lib/types";
import {
  useRundownTiming,
  fmtHora,
  clock,
  heatOf,
  HEAT_TEXT,
  type RundownRow,
} from "@/components/rundown-timing";
import { useRundownRealtime } from "@/components/rundown-realtime";
import { FaixaEncerrado, useCarencia } from "@/components/rundown-salvaguardas";
import { MenuCulto } from "@/components/rundown-menu-culto";

/**
 * O ROTEIRO EM GRADE — o desenho da régia (bloco = linha, campo = coluna).
 *
 * Por que existe em vez de um `layout="colunas"` no grid do celular: as duas
 * telas respondem a perguntas diferentes. No celular, com 380px, a pergunta é
 * "o que eu faço agora" e a resposta é UM bloco grande por vez, empilhado. Na
 * régia, num monitor 16:9, a pergunta é "onde estamos e vamos furar o horário?",
 * e aí o que importa é ver o culto INTEIRO de relance, com hora de relógio em
 * cada linha. Compartilham o cálculo (`useRundownTiming`) e a sincronia
 * (`useRundownRealtime`); divergem no desenho, de propósito.
 *
 * Escolhas de coluna, contra o que Ontime/Cuer fazem:
 *  - SEM coluna de link: 0 dos 28 blocos reais da Aliança usa o campo. Coluna
 *    que nasce vazia parece defeito.
 *  - SEM coluna de tipo: hoje `kind` é a MESMA palavra do título ("Louvor" /
 *    "Louvor"). O tipo já fala pela COR do ponto.
 *  - Observação leva quase toda a folga: é o único campo com texto de verdade,
 *    enquanto os títulos têm 8 caracteres. Bloco e Responsável ficam estreitos.
 *
 * A régia CONDUZ, o celular EDITA. Aqui dá pra iniciar, avançar e encerrar —
 * o que se faz com o culto rolando. Reordenar, criar e apagar bloco continua na
 * aba Roteiro: no meio do culto ninguém reestrutura, e um arraste acidental num
 * monitor de sala de controle sairia caro.
 *
 * TUDO É DIMENSIONADO EM `em`, e o `font-size` da raiz é o que os botões A−/A+
 * mudam. É o que permite adaptar a régia à distância de leitura da sala sem que
 * o texto estoure a coluna: aumentar a letra aumenta junto o respiro das linhas
 * e a largura mínima de cada coluna.
 */

const CHAVE_FONTE = "sirvo:control:fonte";
const FONTE_PADRAO = 15;
const FONTE_MIN = 12;
const FONTE_MAX = 26;

/** Larguras em `em` pra escalarem junto com o controle de fonte. */
const COLS =
  "grid-cols-[2.2em_4.6em_4.6em_4.6em_minmax(6em,0.7fr)_minmax(5em,0.7fr)_minmax(16em,3fr)_auto]";

const TZ = "America/Sao_Paulo";
/** "seg · 3 ago · 17:15" — a régia não precisa de "Segunda-Feira, 3 De Agosto". */
function dataCurta(iso: string): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(d);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value.replace(".", "") ?? "";
  return `${pega("weekday")} · ${pega("day")} ${pega("month")}`;
}

/** "Atrasado 7 min" / "Adiantado 3 min" / "No horário". */
function desvioTexto(ms: number): { texto: string; tom: string } {
  const min = Math.round(ms / 60000);
  if (min === 0) return { texto: "No horário", tom: "bg-success/15 text-success-ink" };
  if (min > 0) return { texto: `Atrasado ${min} min`, tom: "bg-destructive/15 text-destructive-ink" };
  return { texto: `Adiantado ${Math.abs(min)} min`, tom: "bg-success/15 text-success-ink" };
}

/** Rótulo miúdo em cima do número — o número é que tem que ser lido de longe. */
function Medida({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col leading-none">
      <span className={cn("font-bold tabular-nums", className)}>{children}</span>
      <span className="mt-[0.35em] text-[0.62em] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export type CultoOpcao = {
  id: string;
  titulo: string;
  startsAt: string;
  rodando: boolean;
  encerrado: boolean;
  hoje: boolean;
};

/**
 * SELETOR DE CULTO — a saída que a régia não tinha.
 *
 * Em 09/08/2026 a régia ficou presa no culto errado e a única forma de trocar
 * era digitar `?ev=<uuid>` na barra de endereço. Qualquer regra automática vai
 * errar um dia; quando errar, a troca tem que custar dois toques.
 *
 * O selo de data é a outra metade: enquanto o culto exibido não for o de hoje, a
 * data fica âmbar e diz isso com todas as letras. Naquele dia a régia passou
 * horas mostrando um culto de outra semana sem nada na tela denunciando.
 */
function SeletorCulto({
  titulo,
  startsAt,
  deHoje,
  cultos,
}: {
  titulo: string;
  startsAt: string;
  deHoje: boolean;
  cultos: CultoOpcao[];
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

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

  const trocavel = cultos.length > 1;

  return (
    <div ref={caixa} className="relative min-w-0">
      <button
        type="button"
        onClick={() => trocavel && setAberto((v) => !v)}
        disabled={!trocavel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="press-sm -mx-[0.4em] flex min-w-0 items-center gap-[0.5em] rounded-[0.6em] px-[0.4em] py-[0.2em] text-left disabled:pointer-events-none"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-[1.15em] font-extrabold leading-tight">
            {titulo}
          </span>
          <span
            className={cn(
              "mt-[0.15em] inline-flex items-center gap-[0.35em] rounded-full text-[0.72em]",
              deHoje
                ? "text-muted-foreground"
                : "bg-warning/15 px-[0.6em] py-[0.15em] font-bold text-warning-ink",
            )}
          >
            {deHoje ? null : <TriangleAlert className="size-[1.1em]" />}
            {dataCurta(startsAt)}
            {deHoje ? null : " · não é o culto de hoje"}
          </span>
        </span>
        {trocavel ? (
          <ChevronDown
            className={cn("size-[1.1em] shrink-0 text-muted-foreground", aberto && "rotate-180")}
          />
        ) : null}
      </button>

      {aberto ? (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-[0.4em] max-h-[60vh] w-[24em] overflow-y-auto rounded-[0.8em] border border-border bg-card p-[0.3em] shadow-lift"
        >
          {cultos.map((c) => (
            <Link
              key={c.id}
              href={`/control?ev=${c.id}`}
              role="option"
              aria-selected={c.startsAt === startsAt && c.titulo === titulo}
              onClick={() => setAberto(false)}
              className="flex items-center gap-[0.6em] rounded-[0.6em] px-[0.7em] py-[0.5em] hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.95em] font-bold">{c.titulo}</span>
                <span className="block text-[0.78em] text-muted-foreground">
                  {dataCurta(c.startsAt)}
                  {c.hoje ? " · hoje" : ""}
                </span>
              </span>
              {c.rodando ? (
                <span className="inline-flex shrink-0 items-center gap-[0.3em] rounded-full bg-destructive/12 px-[0.6em] py-[0.2em] text-[0.72em] font-extrabold uppercase text-destructive-ink">
                  <span className="size-[0.5em] animate-pulse rounded-full bg-destructive" />
                  ao vivo
                </span>
              ) : c.encerrado ? (
                <span className="shrink-0 rounded-full bg-muted px-[0.6em] py-[0.2em] text-[0.72em] font-bold uppercase text-muted-foreground">
                  encerrado
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Cabecalho() {
  return (
    <div
      className={cn(
        "grid items-end gap-x-[0.9em] border-b border-border px-[0.9em] pb-[0.4em]",
        "text-[0.72em] font-semibold uppercase tracking-wide text-muted-foreground",
        COLS,
      )}
    >
      <span className="text-center">#</span>
      <span>Início</span>
      <span>Fim</span>
      <span>Dur.</span>
      <span>Bloco</span>
      <span>Responsável</span>
      <span>Observação</span>
      <span />
    </div>
  );
}

function Linha({
  row,
  idx,
  cor,
  now,
  podeAvancar,
  onAvancar,
  ocupado,
  canEdit,
  primeiro,
  ultimo,
  onSubir,
  onDescer,
  onEditar,
  refLinha,
}: {
  row: RundownRow;
  idx: number;
  cor: string;
  now: number | null;
  podeAvancar: boolean;
  onAvancar: () => void;
  ocupado: boolean;
  canEdit: boolean;
  primeiro: boolean;
  ultimo: boolean;
  onSubir: () => void;
  onDescer: () => void;
  onEditar: () => void;
  refLinha: (el: HTMLElement | null) => void;
}) {
  const { it, startMs, endMs, durMs, status } = row;
  const live = status === "live";
  const done = status === "done";
  const [aberto, setAberto] = useState(false);

  const decorridoMs = live ? (now != null ? now - startMs : 0) : done ? endMs - startMs : durMs;
  const estourouMs = Math.max(0, decorridoMs - durMs);
  const heat = live ? heatOf(durMs - decorridoMs) : done && estourouMs > 0 ? "red" : "normal";

  // Marca de "estou editando" vale por 2 min (igual ao celular): esquecida por
  // quem fechou o app, ela não pode assombrar o bloco durante o culto.
  const editandoNome =
    it.editingBy && it.editingAt && now != null && now - new Date(it.editingAt).getTime() < 120_000
      ? (it.editingNome ?? "Alguém")
      : null;

  // Sem medir o DOM: texto comprido ou com quebra ganha o "ver tudo". Erra pra
  // mais (mostra o botão em texto que coube), o que é o lado barato de errar.
  const note = it.note ?? "";
  const longo = note.length > 120 || note.includes("\n");

  return (
    <div
      ref={refLinha}
      className={cn(
        "grid items-start gap-x-[0.9em] px-[0.9em] py-[0.62em]",
        COLS,
        live && "bg-primary/[0.07] font-semibold",
        done && "text-muted-foreground",
      )}
      aria-current={live ? "step" : undefined}
    >
      {/* Cor do bloco num PONTO, o mesmo vocabulário da trilha do celular
          (rundown-grid.tsx: nó redondo que fica vermelho ao vivo). */}
      <span className="flex items-center justify-center gap-[0.4em] tabular-nums">
        <span
          className={cn("size-[0.5em] shrink-0 rounded-full", live && "animate-pulse")}
          style={{ backgroundColor: live ? "hsl(var(--destructive))" : cor }}
        />
        {live ? (
          <span className="sr-only">Ao vivo:</span>
        ) : (
          <span className={cn(done && "line-through")}>{idx + 1}</span>
        )}
      </span>

      <span className="tabular-nums">{fmtHora(startMs)}</span>
      <span className={cn("tabular-nums", live && "text-muted-foreground")}>{fmtHora(endMs)}</span>

      {/* duração planejada; ao vivo, o cronômetro ocupa o lugar e ganha a cor */}
      <span className={cn("tabular-nums", live && HEAT_TEXT[heat])}>
        {live ? clock(Math.max(0, decorridoMs)) : `${it.durationMin}m`}
      </span>

      <span className="min-w-0 break-words" title={it.title}>
        {it.title}
        {done && estourouMs > 0 ? (
          <span className="ml-[0.4em] text-[0.8em] font-semibold text-destructive-ink">
            +{clock(estourouMs)}
          </span>
        ) : null}
      </span>

      <span className="min-w-0 break-words text-muted-foreground">{it.responsible || "—"}</span>

      <span className="flex min-w-0 items-start gap-[0.6em]">
        <span className="min-w-0 flex-1">
          {note ? (
            <>
              {/* `whitespace-pre-wrap` preserva as quebras de quem colou o texto;
                  4 linhas é o teto pra uma linha não empurrar o resto da grade
                  pra fora da tela. */}
              {/* `block` e `line-clamp-4` disputam a mesma propriedade
                  (`display`), e quem vence depende da ordem interna do Tailwind,
                  não da ordem aqui — por isso um OU outro, nunca os dois. */}
              <span
                className={cn(
                  "whitespace-pre-wrap break-words",
                  !aberto && longo ? "line-clamp-4" : "block",
                )}
              >
                {note}
              </span>
              {longo ? (
                <button
                  type="button"
                  onClick={() => setAberto((v) => !v)}
                  className="press-sm mt-[0.2em] text-[0.8em] font-bold text-primary"
                >
                  {aberto ? "ver menos" : "ver tudo"}
                </button>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {editandoNome ? (
            <span className="ml-[0.4em] inline-block rounded-full bg-warning/15 px-[0.5em] py-[0.1em] align-middle text-[0.72em] font-semibold text-warning-ink">
              {editandoNome} editando
            </span>
          ) : null}
        </span>

        {podeAvancar && live ? (
          <button
            onClick={onAvancar}
            disabled={ocupado}
            className="press-sm inline-flex shrink-0 items-center gap-[0.4em] rounded-full bg-primary px-[0.8em] py-[0.35em] text-[0.85em] font-bold text-primary-foreground disabled:opacity-60"
          >
            <Check className="size-[1.1em]" /> Encerrar bloco
          </button>
        ) : null}
      </span>

      {/* Reordenar por SETAS, não por arraste: num monitor de sala de controle,
          durante o culto, um arraste acidental reescreveria a ordem do culto sem
          ninguém perceber. Duas setas exigem intenção e não têm meio-termo. */}
      {canEdit ? (
        <span className="flex shrink-0 items-center gap-[0.15em]">
          <button
            onClick={onSubir}
            disabled={ocupado || primeiro}
            aria-label={`Mover "${it.title}" para cima`}
            title="Mover para cima"
            className="press-sm grid size-[1.9em] place-items-center rounded-full text-muted-foreground disabled:opacity-25"
          >
            <ChevronUp className="size-[1.1em]" />
          </button>
          <button
            onClick={onDescer}
            disabled={ocupado || ultimo}
            aria-label={`Mover "${it.title}" para baixo`}
            title="Mover para baixo"
            className="press-sm grid size-[1.9em] place-items-center rounded-full text-muted-foreground disabled:opacity-25"
          >
            <ChevronDown className="size-[1.1em]" />
          </button>
          <button
            onClick={onEditar}
            disabled={ocupado}
            aria-label={`Editar "${it.title}"`}
            title="Editar bloco"
            className="press-sm grid size-[1.9em] place-items-center rounded-full text-muted-foreground disabled:opacity-40"
          >
            <Pencil className="size-[1em]" />
          </button>
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

export function RundownColumns({
  eventId,
  titulo,
  meId,
  startsAt,
  startedAt,
  endedAt,
  items,
  kinds,
  canEdit,
  cultos = [],
  deHoje = true,
  stageMsg = null,
  stageAtalhos = [],
}: {
  eventId: string;
  titulo: string;
  meId: string;
  startsAt: string;
  startedAt: string | null;
  endedAt: string | null;
  items: RundownItem[];
  kinds: RundownKind[];
  canEdit: boolean;
  /** Todos os cultos que a régia pode abrir — alimenta o seletor do cabeçalho. */
  cultos?: CultoOpcao[];
  /** Calculado no servidor, no fuso da igreja (ver a nota em control/page.tsx). */
  deHoje?: boolean;
  /** Mensagem no telão do palco (0050). */
  stageMsg?: StageMsg | null;
  stageAtalhos?: StageAtalho[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [ocupado, startTx] = useTransition();
  const [emCarencia, armarCarencia] = useCarencia();
  const [iniciando, setIniciando] = useState(false);
  const [fonte, setFonte] = useState(FONTE_PADRAO);
  const [editando, setEditando] = useState<RundownItem | "novo" | null>(null);
  const [abrirMsg, setAbrirMsg] = useState(false);

  // O tamanho da letra é do APARELHO, não da conta: depende da distância entre a
  // mesa e o monitor daquela sala — mesma lógica da URL do stream.
  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(CHAVE_FONTE));
      if (salvo >= FONTE_MIN && salvo <= FONTE_MAX) setFonte(salvo);
    } catch {
      /* sem localStorage: fica no padrão */
    }
  }, []);
  const mudarFonte = (delta: number) =>
    setFonte((f) => {
      const novo = Math.min(FONTE_MAX, Math.max(FONTE_MIN, f + delta));
      try {
        localStorage.setItem(CHAVE_FONTE, String(novo));
      } catch {
        /* vale só nesta sessão */
      }
      return novo;
    });

  // Com um modal aberto a atualização espera: um refresh no meio da digitação
  // remontaria a grade debaixo da pessoa. Fora isso a régia não espelha `items`
  // em estado local, então pode atualizar à vontade.
  useRundownRealtime({ eventId, ocupado: editando !== null });

  const { now, rows, totalMin, startedMs, endedMs, finishMs, desvioMs, corDoBloco } =
    useRundownTiming({ items, kinds, startsAt, started: startedAt, ended: endedAt });

  // Bloco ao vivo sempre à vista, MESMA regra do celular: centraliza quando o
  // bloco TROCA, não a cada segundo — senão brigaria com quem rolou a grade pra
  // conferir outro trecho, puxando a tela de volta no meio da leitura.
  const linhaRefs = useRef(new Map<string, HTMLElement>());
  const blocoAtivoId = rows.find((r) => r.status === "live")?.it.id ?? null;
  const editandoRef = useRef(editando);
  editandoRef.current = editando;
  useEffect(() => {
    if (!blocoAtivoId || editandoRef.current) return;
    linhaRefs.current.get(blocoAtivoId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [blocoAtivoId]);

  const rodando = startedMs != null && endedMs == null;
  const desvio = desvioTexto(desvioMs);
  const corridoMs = startedMs != null ? (endedMs ?? now ?? startedMs) - startedMs : 0;

  const agir = (fn: () => Promise<ActionResult>, sucesso?: string) =>
    startTx(async () => {
      const r = await fn();
      if (!r.ok) {
        showToast(r.error);
        return;
      }
      if (sucesso) showToast(sucesso);
      router.refresh();
    });

  /**
   * Transição do modo ao vivo: igual a `agir`, mas arma a carência. Aqui era o
   * pior caso do app — "Iniciar" saía do flex e "Encerrar" entrava no MESMO
   * lugar, mesma altura, mesma largura, e sem confirmação nenhuma. Dois toques
   * no mesmo ponto começavam e encerravam o culto.
   */
  const transicionar = (fn: () => Promise<ActionResult>, sucesso?: string) => {
    armarCarencia();
    agir(fn, sucesso);
  };

  /** Iniciar tem handler próprio só por causa do rótulo "Iniciando…". */
  const iniciar = () => {
    setIniciando(true);
    armarCarencia();
    startTx(async () => {
      const r = await iniciarCronograma(eventId);
      setIniciando(false);
      if (!r.ok) {
        showToast(r.error);
        return;
      }
      router.refresh();
    });
  };

  /** Troca o bloco de lugar com o vizinho e persiste a ordem inteira. */
  const mover = (idx: number, delta: number) => {
    const proxima = [...rows.map((r) => r.it)];
    const destino = idx + delta;
    if (destino < 0 || destino >= proxima.length) return;
    [proxima[idx], proxima[destino]] = [proxima[destino], proxima[idx]];
    agir(() => reordenarCronograma(eventId, proxima.map((x) => x.id)));
  };

  return (
    <div className="flex min-h-0 min-w-[52em] flex-col" style={{ fontSize: `${fonte}px` }}>
      {/* --------------------------------------------------------------------
          UMA barra só, GRUDADA no topo. Antes eram duas — título numa, números
          noutra — e as duas quase vazias. O que a régia lê de longe (corrido e
          desvio) fica grande; o resto encolhe pra rótulo miúdo. O `sticky`
          envolve também os rótulos das colunas: rolar a grade e perder de vista
          o cronômetro OU o nome das colunas quebraria a leitura no meio.
         -------------------------------------------------------------------- */}
      <div className="sticky top-0 z-10 shrink-0 bg-card pt-[0.1em]">
      <div className="mb-[0.7em] flex flex-wrap items-center gap-x-[1.4em] gap-y-[0.5em] rounded-[0.8em] bg-primary/[0.06] px-[0.9em] py-[0.6em]">
        <SeletorCulto titulo={titulo} startsAt={startsAt} deHoje={deHoje} cultos={cultos} />

        <Medida label="início · previsão" className="text-[1.05em]">
          {fmtHora(new Date(startsAt).getTime())}
          <span className="mx-[0.25em] font-normal text-muted-foreground">→</span>
          {fmtHora(finishMs)}
        </Medida>

        {startedMs != null ? (
          <>
            <Medida label="tempo corrido" className="text-[1.9em]">
              {clock(Math.max(0, corridoMs))}
            </Medida>
            <span
              className={cn(
                "rounded-full px-[0.7em] py-[0.3em] text-[1.05em] font-extrabold",
                desvio.tom,
              )}
            >
              {desvio.texto}
            </span>
          </>
        ) : (
          // Antes de começar, este espaço serve pra CONFERIR o plano; depois ele
          // vira o cronômetro, que é o que importa com o culto rolando.
          <span className="text-[0.85em] text-muted-foreground">
            {items.length} blocos · {totalMin} min planejados
          </span>
        )}

        <span className="ml-auto flex items-center gap-[0.4em]">
          {canEdit ? <StageMessageButton ligado={!!stageMsg} onClick={() => setAbrirMsg(true)} em /> : null}
          {/* tamanho da letra: a régia de cada sala tem uma distância de leitura */}
          <span className="mr-[0.4em] inline-flex items-center rounded-full border border-border">
            <button
              onClick={() => mudarFonte(-1)}
              disabled={fonte <= FONTE_MIN}
              aria-label="Diminuir o tamanho do texto"
              title="Diminuir o tamanho do texto"
              className="press-sm grid size-[2em] place-items-center rounded-l-full disabled:opacity-40"
            >
              <Minus className="size-[1em]" />
            </button>
            <span className="px-[0.3em] text-[0.72em] font-bold tabular-nums text-muted-foreground">
              {fonte}
            </span>
            <button
              onClick={() => mudarFonte(1)}
              disabled={fonte >= FONTE_MAX}
              aria-label="Aumentar o tamanho do texto"
              title="Aumentar o tamanho do texto"
              className="press-sm grid size-[2em] place-items-center rounded-r-full disabled:opacity-40"
            >
              <Plus className="size-[1em]" />
            </button>
          </span>

          {canEdit ? (
            <button
              onClick={() => setEditando("novo")}
              disabled={ocupado}
              className="press-sm inline-flex h-[2.4em] items-center gap-[0.4em] rounded-full border border-border px-[0.9em] text-[0.9em] font-bold disabled:opacity-60"
            >
              <Plus className="size-[1.1em]" /> Bloco
            </button>
          ) : null}

          {canEdit && items.length > 0 ? (
            <>
              {startedMs == null ? (
                // A régia não tem estado otimista: `startedMs` só muda quando o
                // servidor responde. Sem um sinal, a janela entre o toque e a
                // resposta é literalmente uma tela que não reagiu — que foi o
                // que fez a pessoa tocar de novo. Daí o rótulo próprio, e um
                // `iniciando` só desta ação (o `ocupado` é de todas, e ticar um
                // bloco não pode fazer este botão dizer "Iniciando…").
                <button
                  onClick={iniciar}
                  disabled={ocupado || emCarencia}
                  className="press-sm inline-flex h-[2.4em] items-center gap-[0.4em] rounded-full bg-primary px-[0.9em] text-[0.9em] font-bold text-primary-foreground disabled:opacity-60"
                >
                  <Play className="size-[1.1em]" /> {iniciando ? "Iniciando…" : "Iniciar"}
                </button>
              ) : null}
              {/* Mesmo menu do celular: o gatilho fica parado no lugar onde
                  antes o "Encerrar" nascia sozinho, e as opções abrem pra baixo.
                  Na régia isso também tira dois alvos da barra, que já estava
                  disputando espaço com fonte, telão e blocos. */}
              {startedMs != null ? (
                <MenuCulto
                  em
                  itens={[
                    ...(rodando
                      ? [
                          {
                            id: "encerrar",
                            rotulo: "Encerrar culto",
                            detalhe: "O relógio para. Dá pra reabrir depois.",
                            icone: <Square className="size-[1.1em] shrink-0" />,
                            destrutivo: true,
                            desabilitado: ocupado || emCarencia,
                            aoEscolher: () =>
                              transicionar(() => encerrarCronograma(eventId), warm("cultoEncerrado")),
                          },
                        ]
                      : []),
                    {
                      id: "reiniciar",
                      rotulo: "Reiniciar roteiro",
                      detalhe: "Apaga início, fim e todos os checks",
                      icone: <RotateCcw className="size-[1.1em] shrink-0" />,
                      segurar: true,
                      desabilitado: ocupado || emCarencia,
                      aoEscolher: () => transicionar(() => reiniciarCronograma(eventId)),
                    },
                  ]}
                />
              ) : null}
            </>
          ) : null}
        </span>
      </div>

        {/* A porta de volta, também dentro do sticky: um culto encerrado por
            engano tem que ser desfeito de onde a pessoa está olhando, sem rolar
            a grade atrás do botão. */}
        {canEdit && endedAt ? (
          <div className="mb-[0.7em]">
            <FaixaEncerrado
              startedAt={startedAt}
              endedAt={endedAt}
              algumTique={items.some((x) => x.doneAt)}
              aoReabrir={() => transicionar(() => reabrirCronograma(eventId), "Culto reaberto.")}
              ocupado={ocupado}
              em
            />
          </div>
        ) : null}

        {/* Dentro do sticky de propósito: numa régia, a mensagem que está no
            telão do palco não pode sair de vista ao rolar a grade. */}
        {stageMsg ? (
          <div className="mb-[0.7em]">
            <StageMessageStrip
              msg={stageMsg}
              eventId={eventId}
              podeMexer={canEdit}
              onAbrir={() => canEdit && setAbrirMsg(true)}
              em
            />
          </div>
        ) : null}

        {items.length > 0 ? <Cabecalho /> : null}
      </div>

      {items.length === 0 ? (
        <p className="grid flex-1 place-items-center text-center text-[0.9em] text-muted-foreground">
          Este culto ainda não tem roteiro.{" "}
          {canEdit ? "Toque em “Bloco” acima pra começar." : "Monte a ordem na aba Roteiro."}
        </p>
      ) : (
        <div className="min-h-0 divide-y divide-border">
          {rows.map((row, idx) => (
            <Linha
              key={row.it.id}
              row={row}
              idx={idx}
              cor={corDoBloco(row.it)}
              now={now}
              podeAvancar={canEdit && rodando}
              ocupado={ocupado}
              onAvancar={() => agir(() => marcarBlocoFeito(row.it.id, eventId, true))}
              canEdit={canEdit}
              primeiro={idx === 0}
              ultimo={idx === rows.length - 1}
              onSubir={() => mover(idx, -1)}
              onDescer={() => mover(idx, 1)}
              onEditar={() => setEditando(row.it)}
              refLinha={(el) => {
                if (el) linhaRefs.current.set(row.it.id, el);
                else linhaRefs.current.delete(row.it.id);
              }}
            />
          ))}
        </div>
      )}

      {/* MESMO modal do celular (exportado de rundown-grid.tsx): duas telas de
          edição divergiriam, e a trava por versão da 0048 depende das duas
          mandarem o `contentUpdatedAt` igual. Sem "gerenciar tipos" aqui —
          isso é montar roteiro, não conduzir culto. */}
      {editando ? (
        <BlocoModal
          eventId={eventId}
          item={editando === "novo" ? null : editando}
          meId={meId}
          kinds={kinds}
          onDelete={
            editando !== "novo"
              ? () => {
                  const alvo = editando;
                  setEditando(null);
                  agir(() => removerBlocoCronograma(alvo.id, eventId));
                }
              : undefined
          }
          onClose={() => setEditando(null)}
        />
      ) : null}

      {/* O MESMO painel do celular: duas telas de envio divergiriam, e esta é a
          informação que menos pode discordar entre quem manda e quem confere. */}
      <StageMessageSheet
        open={abrirMsg}
        onClose={() => setAbrirMsg(false)}
        eventId={eventId}
        msg={stageMsg}
        atalhos={stageAtalhos}
      />
    </div>
  );
}
