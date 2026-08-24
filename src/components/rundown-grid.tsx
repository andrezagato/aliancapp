"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Check,
  Play,
  RotateCcw,
  Square,
  ExternalLink,
  Settings2,
  LayoutTemplate,
  X,
  CalendarDays,
  FolderOpen,
  FolderPlus,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import {
  StageMessageButton,
  StageMessageSheet,
  StageMessageStrip,
  type StageAtalho,
  type StageMsg,
} from "@/components/stage-message";
import { cn } from "@/lib/utils";
import {
  adicionarBlocoCronograma,
  atualizarBlocoCronograma,
  removerBlocoCronograma,
  reordenarCronograma,
  ajustarDuracaoBloco,
  iniciarCronograma,
  reiniciarCronograma,
  encerrarCronograma,
  reabrirCronograma,
  marcarBlocoFeito,
  adicionarTipoBloco,
  removerTipoBloco,
  salvarModeloCronograma,
  excluirModeloCronograma,
  aplicarModeloCronograma,
  contribuirNoBloco,
  marcarEditandoBloco,
} from "@/lib/actions";
import { warm } from "@/lib/toasts";
import type { RundownItem, RundownKind, RundownTemplate } from "@/lib/data";
import { CATEGORY_HEXES, CATEGORY_NEUTRAL } from "@/lib/palette";
import {
  useRundownTiming,
  fmtHora as fmt,
  clock,
  heatOf,
  HEAT_TEXT,
  type Heat,
} from "@/components/rundown-timing";
import { useRundownRealtime } from "@/components/rundown-realtime";
import { BotaoSegurar, FaixaEncerrado, useCarencia } from "@/components/rundown-salvaguardas";
import { MenuCulto, type ItemMenuCulto } from "@/components/rundown-menu-culto";
import { PastaModal } from "@/components/pasta-evento-modal";
import { DuracaoPopover } from "@/components/rundown-duracao-popover";

/**
 * ALTURA ÚNICA DE TODO BLOCO.
 *
 * A altura proporcional à duração (`MIN_H` + `duração × PX_PER_MIN`) morreu junto
 * com a alça de redimensionar que ela servia: sem arrastar a borda, a proporção
 * deixou de ser affordance e virou só irregularidade — um bloco de 40 min tomava
 * meia tela e um de 2 min sumia entre os vizinhos. Roteiro no celular se lê como
 * LISTA, não como gráfico de tempo; quem quer proporção olha a régia.
 *
 * É `min-height`, não altura travada: observação longa faz o card crescer. Cortar
 * o único campo com texto de verdade seria pior que a irregularidade que a altura
 * fixa resolve.
 */
const ALTURA_BLOCO = 92;
// Cor de bloco vem da Paleta de Categoria (DESIGN.md) — a rampa antiga era a
// paleta default do Tailwind (ciano/violeta/azul), fria e de outra casa.
const SWATCHES = [...CATEGORY_HEXES, CATEGORY_NEUTRAL];

/**
 * TRAVA MACIA (migration 0048) — quanto tempo a marca "estou editando" vale.
 *
 * Curto de propósito: no meio de um culto, uma marca esquecida por quem fechou o
 * app não pode assombrar o bloco. Depois disto o bloco lê como livre — e mesmo
 * antes, dá pra assumir confirmando. O que garante que nada se perde é a VERSÃO
 * (`contentUpdatedAt`), não esta marca.
 */
const TRAVA_TTL_MS = 2 * 60_000;

/**
 * Quanto tempo o auto-scroll pro bloco ao vivo fica em silêncio depois de UM
 * TIQUE NOSSO (F3 do DECISOES-TIQUE.md).
 *
 * Sem isto, marcar um bloco como feito troca `blocoAtivoId` na hora, o efeito de
 * centralização dispara no mesmo quadro e a lista desliza debaixo do dedo que
 * acabou de tocar — o segundo toque, se vier, acerta outro bloco. ~700ms cobre
 * o tempo de o dedo sair da tela depois do toque.
 */
const SEGURA_SCROLL_MS = 700;

/**
 * Quanto antes da hora marcada o roteiro já conta como "ao vivo" pra sincronia.
 * Uma hora: é quando a equipe monta o roteiro e é quando alguém aperta Iniciar.
 */
const QUASE_LA_MS = 60 * 60_000;

/** Nome de quem está com o bloco na mão agora, ou `null` se está livre. */
function quemEstaEditando(item: RundownItem, meId: string): string | null {
  if (!item.editingBy || !item.editingAt || item.editingBy === meId) return null;
  if (Date.now() - new Date(item.editingAt).getTime() > TRAVA_TTL_MS) return null;
  return item.editingNome ?? "Outra pessoa";
}

/**
 * Marca o bloco como "em edição" enquanto o modal está aberto e solta ao fechar.
 * Aceita `null` porque o mesmo modal serve pra criar bloco, quando não há o que
 * marcar.
 */
function useMarcaDeEdicao(blocoId: string | null) {
  useEffect(() => {
    if (!blocoId) return;
    void marcarEditandoBloco(blocoId, true);
    return () => {
      void marcarEditandoBloco(blocoId, false);
    };
  }, [blocoId]);
}

/** Aviso de que outra pessoa abriu o bloco antes de você. */
function AvisoDeEdicao({ nome }: { nome: string }) {
  return (
    <p className="rounded-[14px] bg-warning/10 px-3 py-2 text-[13px] leading-snug text-warning-ink">
      <strong>{nome}</strong> abriu este bloco pra editar agora. Se salvar por cima, o que a outra
      pessoa escrever depois não vai ser perdido — o app recusa e avisa. Mas talvez valha combinar
      antes.
    </p>
  );
}

/**
 * Contador da coluna fina: número em cima, rótulo embaixo, os dois centrados.
 *
 * Saiu de dentro do card (ago/2026) e virou coluna própria: ali ele disputava a
 * primeira linha com o título do bloco, e é ele que a pessoa procura primeiro
 * quando o culto está rolando. O rótulo continua em caixa baixa e sem tracking —
 * "estourou" em caixa-alta não cabe em 58px.
 */
function Contador({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className={cn("text-sm font-extrabold leading-none tabular-nums", className)}>
        {value}
      </span>
      <span className="mt-0.5 text-[11px] font-extrabold leading-none text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/**
 * Sobrou só o REORDENAR. O `mode` fica: ele é o que o resto do arquivo lê pra
 * saber "tem mão no bloco agora?" (o guarda do clique, a válvula do tempo real,
 * o realce do card arrastado). Redimensionar saiu por decisão do dono — a
 * duração agora se muda pelo popover, que não depende de precisão de pixel.
 */
// `pointerId` entrou junto porque sem ele os listeners de window não sabem de
// QUEM é o evento: com dois dedos na tela (mão apoiada, o que acontece segurando
// o celular de lado), o segundo `beginReorder` sobrescrevia o `drag.id` e o dedo
// #1 passava a arrastar o bloco do dedo #2 — e o primeiro que levantasse
// persistia a ordem, matando o gesto do outro.
// `armado` separa "o dedo encostou na alça" de "o dedo está ARRASTANDO". Antes só
// existia o segundo estado, e ele começava no toque — por isso os 2-5px que todo
// dedo escorrega ao encostar já reordenavam. `origem` guarda onde o dedo pousou,
// pra medir a distância percorrida.
type Drag = {
  mode: "reorder";
  id: string;
  pointerId: number;
  armado: boolean;
  origem: { x: number; y: number };
} | null;

/**
 * Quanto o dedo precisa andar pra virar arraste.
 *
 * DISTÂNCIA, não tempo. Atraso pune quem acertou o gesto — segurar 300ms antes de
 * qualquer coisa acontecer é o que faz uma tela parecer travada. Distância só
 * filtra quem NÃO quis arrastar: quem quer arrastar já vai andar muito mais que
 * isso, e nem percebe o limiar.
 *
 * 8px é abaixo do que uma rolagem intencional percorre e acima do escorregão de
 * quem só quis encostar. Não usamos apertar-e-segurar: o iOS sequestra pressão
 * longa como seleção de texto (está escrito em rundown-salvaguardas), e segurar
 * poria latência justamente no gesto que precisa parecer imediato.
 */
const LIMIAR_ARME = 8;

export function RundownGrid({
  eventId,
  startsAt,
  startedAt,
  endedAt,
  items,
  kinds,
  templates,
  canEdit,
  canContribute,
  meId,
  filesUrl = null,
  escalaHref,
  stageMsg = null,
  stageAtalhos = [],
}: {
  eventId: string;
  startsAt: string;
  startedAt: string | null;
  endedAt: string | null;
  items: RundownItem[];
  kinds: RundownKind[];
  templates: RundownTemplate[];
  canEdit: boolean;
  canContribute: boolean;
  /** Pra não avisar "você está editando" pra própria pessoa (trava da 0048). */
  meId: string;
  /** Pasta de arquivos do culto (OneDrive/Drive), quando vinculada. */
  filesUrl?: string | null;
  escalaHref?: string;
  /** Mensagem no monitor de palco (0050): quem pode conduzir manda, todos veem. */
  stageMsg?: StageMsg | null;
  stageAtalhos?: StageAtalho[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pendente, startTx] = useTransition();
  // Todo controle do modo ao vivo nasce dormindo depois de uma transição — é o
  // que impede o segundo toque de quem achou que o primeiro não pegou.
  const [emCarencia, armarCarencia] = useCarencia();

  const [list, setList] = useState(items);
  const [started, setStarted] = useState<string | null>(startedAt);
  const [ended, setEnded] = useState<string | null>(endedAt);
  const [drag, setDrag] = useState<Drag>(null);
  /**
   * MODO DA TELA. Conduzir é o domingo; reordenar é montar.
   *
   * Virou modo porque arrastar solto no meio da lista é ambíguo por natureza —
   * o mesmo dedo, no mesmo pixel, pode querer rolar ou mover, e nenhum limiar
   * resolve isso de verdade (só desloca a fronteira do erro). Num modo, a
   * pergunta não existe: ali dentro, dedo que anda MOVE.
   */
  const [modo, setModo] = useState<"conduzir" | "reordenar">("conduzir");
  const [editing, setEditing] = useState<RundownItem | "new" | null>(null);
  const [contributing, setContributing] = useState<RundownItem | null>(null);
  const [manageKinds, setManageKinds] = useState(false);
  const [manageTpl, setManageTpl] = useState(false);
  const [abrirMsg, setAbrirMsg] = useState(false);
  const [abrirPasta, setAbrirPasta] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null); // bloco recém-movido (destaque pós-drop)
  // Qual bloco está com o popover de duração aberto (id) — ou `null`.
  const [duracaoAberta, setDuracaoAberta] = useState<string | null>(null);
  // Salvamento com atraso: cada toque no ± vale na hora na tela e junta os toques
  // numa ida só ao servidor.
  const salvarDurRef = useRef<number | null>(null);

  // Palpites de duração ainda não confirmados pelo servidor. Existe porque
  // `ajustarDuracaoBloco` faz `revalidatePath` e o Next re-renderiza a rota junto
  // com a resposta da action, mesmo sem `router.refresh()` — sem este filtro o
  // `items` que chega no meio dos toques reescreve o número debaixo do dedo.
  const durPendenteRef = useRef(new Map<string, number>());
  /** Fila de saves: dois toques no mesmo bloco têm que chegar no servidor NA
   *  ORDEM em que foram tocados. Sem a fila, o segundo pode ultrapassar o
   *  primeiro e o valor ANTIGO vence — e o roteiro passa a mentir. */
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const p = durPendenteRef.current;
    for (const it of items) if (p.get(it.id) === it.durationMin) p.delete(it.id);
    setList(p.size === 0 ? items : items.map((it) => (p.has(it.id) ? { ...it, durationMin: p.get(it.id)! } : it)));
  }, [items]);
  useEffect(() => setStarted(startedAt), [startedAt]);
  useEffect(() => setEnded(endedAt), [endedAt]);

  // Tempo real (migration 0047) mora no hook, compartilhado com a régia. Aqui
  // `ocupado` importa: este grid espelha `items` em estado local, então atualizar
  // no meio de um arraste ou com modal aberto atropelaria a mão da pessoa.
  // O popover entra na conta: um refresh chegando entre dois toques no "+" traria
  // o `items` antigo do servidor e o número pularia pra trás debaixo do dedo.
  const ocupado =
    drag !== null ||
    // O MODO INTEIRO É "mão na massa", não só o instante do arraste. Sem isto o
    // tempo real reescreve `items` no meio da reorganização e a ordem que a
    // pessoa está montando se desfaz debaixo dela — e ela não teria como saber
    // que foi o servidor, ia achar que o próprio dedo errou.
    modo !== "conduzir" ||
    editing !== null || contributing !== null || manageKinds || manageTpl || duracaoAberta !== null;
  // O ritmo NUNCA fica mais lento que a verdade do servidor. `started`/`ended`
  // são otimistas: servem pra ACELERAR no instante em que a pessoa toca
  // Iniciar, nunca pra desacelerar por causa de uma action que falhou — um
  // "encerrar" recusado pelo RLS deixaria a tela achando que acabou e a
  // sincronia cairia pro degrau lento COM O CULTO NO AR.
  // A hora antes da marcada também conta: é este laço que traz o `startedAt`.
  const aoVivo =
    !(ended != null && endedAt != null) &&
    (started != null ||
      startedAt != null ||
      Date.now() >= new Date(startsAt).getTime() - QUASE_LA_MS);
  useRundownRealtime({ eventId, ocupado, aoVivo });
  // Ref à parte pra centralizar no bloco ao vivo lendo o valor mais recente sem
  // reexecutar o efeito (ele depende da TROCA de bloco, não de `ocupado`).
  const ocupadoRef = useRef(ocupado);
  ocupadoRef.current = ocupado;
  // TIQUE NOSSO (F3): fica `true` por `SEGURA_SCROLL_MS` depois que ESTE
  // aparelho marca um bloco como feito, pra segurar o auto-scroll abaixo — não
  // é sobre outro alguém ticando em outro aparelho, é sobre não competir com o
  // dedo que acabou de tocar aqui.
  const tiqueNossoRef = useRef(false);

  const listRef = useRef(list);
  listRef.current = list;
  const dragRef = useRef<Drag>(null);
  dragRef.current = drag;
  const itemRefs = useRef(new Map<string, HTMLElement>());
  // Trava síncrona: engole o "click fantasma" que o navegador dispara logo após
  // arrastar/redimensionar (o pointerup zera o drag antes do click chegar, então
  // só o guard `!drag` não segura — daí o modal abrir sem querer).
  const suppressClickRef = useRef(false);

  // ---- Projeção de horários -----------------------------------------------
  // Mora no hook: a grade da régia (`rundown-columns.tsx`) desenha OUTRA coisa a
  // partir exatamente destes números, e as duas telas não podem discordar sobre
  // que hora começa o sermão.
  const {
    now,
    rows,
    totalMin,
    allDone,
    startedMs,
    plannedStartMs,
    finishMs,
    liveNow,
    overFinish,
    corDoBloco: colorOf,
  } = useRundownTiming({ items: list, kinds, startsAt, started, ended });

  // ---- Persistência -------------------------------------------------------
  const persistOrder = (next: RundownItem[]) =>
    startTx(async () => {
      await reordenarCronograma(eventId, next.map((x) => x.id));
      router.refresh();
    });
  // Espelhado em ref pelo mesmo motivo do `listRef` logo acima: `finalizar`
  // precisa chamar isto e precisa ser ESTÁVEL. Se `persistOrder` entrasse nas
  // deps, `finalizar` mudaria de identidade a cada render, `soltarListeners`
  // junto — e o efeito de desmonte, que depende dele, rodaria sua limpeza a cada
  // render, arrancando os listeners NO MEIO do arraste. O `eslint-disable` que
  // estava aqui antes escondia exatamente essa armadilha em vez de resolvê-la.
  const persistOrderRef = useRef(persistOrder);
  persistOrderRef.current = persistOrder;
  const salvarDuracao = (id: string, min: number) => {
    salvarDurRef.current = null;
    const proxima = filaRef.current.then(async () => {
      const r = await ajustarDuracaoBloco(id, eventId, min);
      if (!r.ok) {
        durPendenteRef.current.delete(id); // volta pro que o servidor tem
        showToast(r.error);
      }
    });
    filaRef.current = proxima.catch(() => {});
    startTx(async () => {
      await proxima.catch(() => {});
    });
  };

  /** Toque no ±: vale na tela imediatamente, vai pro servidor 600ms depois. */
  const mudarDuracao = (id: string, min: number) => {
    durPendenteRef.current.set(id, min);
    setList((prev) => prev.map((x) => (x.id === id ? { ...x, durationMin: min } : x)));
    if (salvarDurRef.current) window.clearTimeout(salvarDurRef.current);
    salvarDurRef.current = window.setTimeout(() => salvarDuracao(id, min), 600);
  };

  // Não precisa tratar "mudou de bloco com save pendente": abrir o popover de B
  // dispara o pointerdown fora de A, que fecha A e dá flush.
  /** Fechar garante que o ÚLTIMO toque foi pro servidor antes de soltar a tela.
   *  Lê de REF, nunca de estado: o listener de "tocar fora" mora num efeito com
   *  deps [aberto] e carrega a closure de quando o popover ABRIU. */
  const fecharDuracao = () => {
    const id = duracaoAberta;
    if (salvarDurRef.current) {
      window.clearTimeout(salvarDurRef.current);
      salvarDurRef.current = null;
      const min = id ? durPendenteRef.current.get(id) : undefined;
      if (id && min != null) salvarDuracao(id, min);
    }
    // Engole O PRÓXIMO clique em vez de apostar num prazo: o clique sintético vem
    // depois do pointerup, e num toque lento isso passa dos 60ms que o arraste usa.
    // Sem isto, dispensar o popover ABRE o modal do bloco por baixo.
    const engolir = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    document.addEventListener("click", engolir, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener("click", engolir, true), 400);
    setDuracaoAberta(null);
    // SEM `router.refresh()`: a própria action revalida a rota, e um refresh no
    // fechar refaria meia dúzia de queries do /cronograma à toa.
  };

  // Cronômetro pendente não pode sobreviver ao desmonte da tela.
  useEffect(
    () => () => {
      if (salvarDurRef.current) window.clearTimeout(salvarDurRef.current);
    },
    [],
  );

  // ---- Gestos (arrastar) --------------------------------------------------
  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    // FILTRA PELO PONTEIRO QUE COMEÇOU O GESTO. Este era o furo: o filtro existia
    // só no soltar e no cancelar, e o handler que ARMA e CALCULA aceitava evento
    // de qualquer dedo na página.
    //
    // O acidente: dedo #1 encosta na alça do bloco 3 e fica parado. A outra mão
    // segura o aparelho e o polegar #2 desliza na borda. O `pointermove` do dedo
    // #2 chega aqui, e a distância é medida entre a coordenada DELE e a origem do
    // dedo #1 — o limiar de 8px é atropelado na hora, o gesto arma sem ninguém ter
    // arrastado nada, e a `vaga` sai do Y do polegar #2: o bloco 3 salta pra onde
    // ele está. Como o pointerup do #2 é descartado pelo filtro (que lá existe), o
    // gesto nem termina; quando o #1 levanta, a ordem acidental é GRAVADA — com
    // push de tempo real pro aparelho de toda a equipe, no meio do culto.
    if (e.pointerId !== d.pointerId) return;
    // Ainda não armou? Só arma se o dedo andou o bastante — e enquanto não armar,
    // NADA se move. É aqui que morre o "mudou a ordem sem eu querer".
    if (!d.armado) {
      const dx = e.clientX - d.origem.x;
      const dy = e.clientY - d.origem.y;
      if (dx * dx + dy * dy < LIMIAR_ARME * LIMIAR_ARME) return;
      // Euclidiana, não só vertical: quem começa o gesto na diagonal (o polegar
      // faz arco, não linha reta) armaria tarde demais medindo só o eixo Y.
      dragRef.current = { ...d, armado: true };
      setDrag(dragRef.current);
    }
    const ids = listRef.current.map((x) => x.id);
    // `vaga` é ONDE ENTRA, não sobre quem passou: 0 = antes do primeiro, 1 = entre
    // o 1º e o 2º, e assim por diante até `ids.length` = depois do último. O laço
    // acha a primeira linha cujo meio está ABAIXO do dedo; se nenhuma está, o dedo
    // passou de todas e a vaga é o fim.
    //
    // O padrão era `ids.length - 1`, que é a última LINHA, não a última VAGA —
    // então arrastar pra depois do último bloco parava uma casa antes.
    let vaga = ids.length;
    for (let i = 0; i < ids.length; i++) {
      const el = itemRefs.current.get(ids[i]);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        vaga = i;
        break;
      }
    }
    const cur = listRef.current;
    const from = cur.findIndex((x) => x.id === d.id);
    if (from === -1) return;
    // ERRO DE ÍNDICE — este era o "pula duas casas".
    //
    // `vaga` descreve o array de ANTES. O splice de remoção acontece primeiro e
    // desce em 1 todos os índices acima de `from`; inserir na `vaga` crua depois
    // disso põe o bloco uma posição além. Traço com [A,B,C] e A na mão, dedo logo
    // depois do meio de B: vaga=2, remove A -> [B,C], insere em 2 -> [B,C,A],
    // quando o certo é [B,A,C]. Só acontecia PRA BAIXO — pra cima os índices não
    // se deslocam —, e é essa assimetria que fazia o gesto parecer aleatório em
    // vez de só sensível.
    let alvo = vaga > from ? vaga - 1 : vaga;
    // TRAVA NO PISO. Sem isto o dedo arrasta o bloco pra cima do ao vivo e o
    // culto teleporta pra ele — o `liveIdx` é derivado da ordem, então "subiu
    // acima do ao vivo" e "virou o ao vivo" são a mesma coisa. O bloco encosta
    // no piso e para, em vez de recusar o gesto inteiro: parar é legível, e
    // recusar no meio do arraste pareceria travamento.
    const piso = pisoRef.current;
    if (alvo <= piso) alvo = piso + 1;
    if (alvo !== from) {
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(alvo, 0, moved);
      setList(next);
    }
  }, []);

  // ---- FIM DE GESTO GARANTIDO ---------------------------------------------
  //
  // Antes existia UM caminho de saída: `pointerup` com {once:true}. Quando o iOS
  // cancelava o ponteiro — central de controle, notificação, segundo dedo,
  // chamada chegando — esse pointerup NUNCA vinha, e nada era desfeito:
  //
  //   · `drag` ficava não-nulo pra sempre. E `drag` alimenta `ocupado`, que é a
  //     válvula do tempo real: o roteiro daquele aparelho PARAVA de receber
  //     atualização pelo resto do culto, em silêncio;
  //   · `suppressClickRef` ficava true, e o guarda do clique no card engolia
  //     tudo — o modal do bloco não abria mais;
  //   · o `pointermove` seguia pendurado na window com o `dragRef` apontando pro
  //     bloco: QUALQUER movimento de dedo na página passava a reordenar o roteiro.
  //
  // Só se curava quando alguém agarrava a alça de novo e completava um gesto
  // limpo. É o candidato mais forte pro "não está muito estável" relatado ao vivo.
  //
  // Os handlers moram em refs porque `finalizar` precisa REMOVER os dois, e os
  // dois precisam CHAMAR `finalizar` — a referência estável tem que existir antes
  // de cada um ser definido, senão o removeEventListener recebe outra função e
  // não remove nada.
  const aoSoltarRef = useRef<((e: PointerEvent) => void) | null>(null);
  const aoCancelarRef = useRef<((e: PointerEvent) => void) | null>(null);
  const ordemAoIniciarRef = useRef<RundownItem[] | null>(null);

  const soltarListeners = useCallback(() => {
    window.removeEventListener("pointermove", onPointerMove);
    if (aoSoltarRef.current) window.removeEventListener("pointerup", aoSoltarRef.current);
    if (aoCancelarRef.current) window.removeEventListener("pointercancel", aoCancelarRef.current);
  }, [onPointerMove]);

  const finalizar = useCallback(
    (persistir: boolean) => {
      const d = dragRef.current;
      soltarListeners();
      setDrag(null);
      // Mantém a trava por um instante: o click sintético do fim do gesto chega
      // logo depois; limpamos em seguida pra taps normais valerem.
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 60);
      const antes = ordemAoIniciarRef.current;
      ordemAoIniciarRef.current = null;
      if (!d) return;
      if (persistir) {
        // GRAVAR SÓ SE HOUVE ARRASTE E SE A ORDEM MUDOU DE VERDADE.
        //
        // Sem armar, o gesto foi um toque na alça e não há nada a dizer ao
        // servidor. E mesmo armado, a pessoa pode ter arrastado e voltado pro
        // mesmo lugar. Gravar nesses casos custaria um `reordenarCronograma`, um
        // `router.refresh()` e um push de tempo real pra todo aparelho da equipe
        // — durante o culto — pra comunicar exatamente nada.
        const mudou =
          d.armado && (antes === null || antes.some((x, i) => x.id !== listRef.current[i]?.id));
        if (mudou) {
          persistOrderRef.current(listRef.current);
          setFlashId(d.id);
          window.setTimeout(() => setFlashId(null), 900);
        }
        return;
      }
      // CANCELADO VOLTA ATRÁS, e isso é decisão, não descuido. `pointercancel` no
      // iOS é quase sempre o sistema tomando o gesto pra si — ou seja, o caso
      // ACIDENTAL, que é justamente o que a pessoa reclamou. Gravar a ordem de um
      // gesto que ela não terminou seria transformar o acidente em fato no banco,
      // com push de tempo real pra equipe inteira e sem nada na tela dizendo o quê.
      if (antes) setList(antes);
    },
    [soltarListeners],
  );

  const aoSoltar = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId !== d.pointerId) return;
      finalizar(true);
    },
    [finalizar],
  );

  const aoCancelar = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId !== d.pointerId) return;
      finalizar(false);
    },
    [finalizar],
  );

  useEffect(() => {
    aoSoltarRef.current = aoSoltar;
    aoCancelarRef.current = aoCancelar;
  }, [aoSoltar, aoCancelar]);

  // DESMONTE NO MEIO DO GESTO. Trocar de rota (o `router.replace` do "fixar neste
  // culto"), um Suspense re-suspendendo, o culto encerrando — qualquer um desmonta
  // esta tela com o dedo na alça. Sem esta limpeza os listeners sobrevivem na
  // window com closures de um componente morto, e o pointerup seguinte dispara
  // `persistOrder` de uma tela que não existe mais.
  useEffect(() => () => soltarListeners(), [soltarListeners]);

  /**
   * MOVER UMA CASA, pelo botão. É o caminho de teclado e de leitor de tela — o
   * arraste não tem equivalente acessível, e sem isto o modo seria inalcançável
   * pra quem navega por Tab. Também serve pro dedo que prefere precisão a gesto.
   */
  const moverUma = (id: string, delta: -1 | 1) => {
    const cur = listRef.current;
    const from = cur.findIndex((x) => x.id === id);
    if (from === -1) return;
    const alvo = from + delta;
    // Mesmo piso do arraste: nada passa pra cima do bloco ao vivo.
    if (alvo <= pisoRef.current || alvo >= cur.length) return;
    const next = [...cur];
    const [moved] = next.splice(from, 1);
    next.splice(alvo, 0, moved);
    setList(next);
    persistOrderRef.current(next);
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 900);
  };

  const beginReorder = (e: React.PointerEvent, it: RundownItem) => {
    // Só o botão primário arma. Antes, botão direito do mouse também armava — e no
    // computador da régia o menu de contexto engole o pointerup, o que reproduzia
    // exatamente o travamento do pointercancel.
    if (e.button !== 0) return;
    // Só dentro do modo, e só abaixo do piso. Fora do modo o dedo na lista é
    // rolagem, sempre — que é o que acaba com a ambiguidade de vez.
    if (modo !== "reordenar" || !podeMover(it.id)) return;
    e.preventDefault();
    e.stopPropagation();
    // Um gesto por vez: se sobrou algo de um anterior, encerra sem gravar.
    if (dragRef.current) finalizar(false);
    suppressClickRef.current = true;
    ordemAoIniciarRef.current = listRef.current;
    setDrag({
      mode: "reorder",
      id: it.id,
      pointerId: e.pointerId,
      armado: false,
      origem: { x: e.clientX, y: e.clientY },
    });
    window.addEventListener("pointermove", onPointerMove);
    if (aoSoltarRef.current) window.addEventListener("pointerup", aoSoltarRef.current);
    if (aoCancelarRef.current) window.addEventListener("pointercancel", aoCancelarRef.current);
  };

  /**
   * AFIRMAR, NUNCA INVERTER — e é essa palavra que conserta o telão piscando.
   *
   * Antes existia um `toggleDone` que decidia o destino assim:
   *
   *     const done = !it.doneAt;
   *
   * O servidor nunca foi toggle (recebe estado absoluto e, ao marcar, ainda faz
   * `.is("done_at", null)`). O CLIENTE é que era — e ele decidia lendo um estado
   * que o tempo real acabara de trocar por baixo dele.
   *
   * O acidente, em ordem: A tica o bloco 5. O realtime chega no aparelho de B. A
   * linha NÃO SAI DO LUGAR — muda cor, risco e o anel do ao vivo, mas fica no
   * mesmo pixel. O dedo de B já estava a caminho do mesmo tique. B toca achando
   * que MARCA, o `!it.doneAt` agora vale false, e B DESMARCA. Duas pessoas
   * querendo a mesma coisa produzem o oposto dela.
   *
   * Com marcar e desmarcar separados, o toque de domingo só sabe afirmar: dois
   * dedos afirmando a mesma coisa dão um resultado só, e toque duplo acidental
   * vira no-op no `.is("done_at", null)` que já existia no servidor.
   */
  const seguraAutoScroll = () => {
    // Marca que o PRÓXIMO troco de bloco ao vivo veio de um toque aqui, e
    // segura o auto-scroll por um instante — ver `SEGURA_SCROLL_MS` (F3).
    tiqueNossoRef.current = true;
    window.setTimeout(() => {
      tiqueNossoRef.current = false;
    }, SEGURA_SCROLL_MS);
  };

  const marcarFeito = (it: RundownItem) => {
    if (it.doneAt) return; // já está feito: afirmar de novo não tem o que dizer
    seguraAutoScroll();
    setList((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, doneAt: new Date().toISOString() } : x)),
    );
    startTx(async () => {
      const r = await marcarBlocoFeito(it.id, eventId, true);
      // Sem isto o bloco "destica sozinho" quando a action falha — o próximo
      // `items` do servidor (sem a marca) sobrescreve o palpite otimista de
      // cima, e ninguém entende por quê (F2).
      if (r.ok) router.refresh();
      else showToast(r.error);
    });
  };

  const desmarcarFeito = (it: RundownItem) => {
    const antes = it.doneAt;
    if (!antes) return;
    seguraAutoScroll();
    setList((prev) => prev.map((x) => (x.id === it.id ? { ...x, doneAt: null } : x)));
    startTx(async () => {
      // Manda o carimbo que ESTA tela viu: se outra pessoa reabriu e concluiu o
      // bloco no meio do gesto de segurar, o servidor recusa em vez de apagar a
      // marca nova dela.
      const r = await marcarBlocoFeito(it.id, eventId, false, antes);
      if (r.ok) {
        router.refresh();
        return;
      }
      // REPÕE O CARIMBO ORIGINAL, não "agora". `rundown-timing` empurra todo bloco
      // seguinte pelo `done_at` do anterior, então inventar a hora aqui deslocaria
      // a projeção do resto do culto e faria o "atrasado/adiantado" mentir até
      // alguém recarregar a página.
      setList((prev) => prev.map((x) => (x.id === it.id ? { ...x, doneAt: antes } : x)));
      showToast(r.error);
    });
  };

  /**
   * PRENDE A TELA NESTE CULTO antes de mexer no estado dele.
   *
   * Sem `?ev=` na URL, cada `router.refresh()` faz o servidor reperguntar "qual
   * culto abrir?" — e a resposta MUDA no instante em que se encerra. Foi assim
   * que o Culto de Oração do dia 14 sumiu debaixo do dedo em 10/08/2026: no
   * quadro seguinte ao "Encerrar", a escolha caiu no Culto de Domingo do dia 16 e
   * a tela deslizou sozinha pra outro culto — a mesma teleportação de 09/08, só
   * que numa data futura, onde o remendo daquele dia não alcançava.
   *
   * Fixar a URL torna a pergunta desnecessária: quem agiu num culto continua
   * nele, aconteça o que acontecer com a heurística.
   */
  const fixarNesteCulto = useCallback(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("ev") === eventId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("ev", eventId);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const start = () => {
    setStarted(new Date().toISOString());
    armarCarencia();
    fixarNesteCulto();
    startTx(async () => {
      const r = await iniciarCronograma(eventId);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });
  };
  const reset = () => {
    setStarted(null);
    setEnded(null);
    setList((prev) => prev.map((x) => ({ ...x, doneAt: null })));
    armarCarencia();
    fixarNesteCulto();
    startTx(async () => {
      await reiniciarCronograma(eventId);
      router.refresh();
    });
  };
  const encerrar = () => {
    setEnded(new Date().toISOString());
    armarCarencia();
    fixarNesteCulto();
    startTx(async () => {
      const r = await encerrarCronograma(eventId);
      if (r.ok) {
        showToast(warm("cultoEncerrado"));
        router.refresh();
      } else {
        // DESFAZ o otimismo, igual ao `reabrir` já fazia. Sem isto a tela ficava
        // "Encerrado" pra sempre — o espelho `useEffect(…, [endedAt])` não
        // conserta, porque a prop não MUDOU. E desde que o ritmo da sincronia
        // passou a seguir esse estado, ficar preso aqui derrubaria o laço pro
        // degrau lento com o culto ainda no ar.
        setEnded(endedAt);
        showToast(r.error);
      }
    });
  };
  /** O desfazer da 0051: o start e os tiques ficam de pé, só o fim é apagado. */
  const reabrir = () => {
    setEnded(null);
    armarCarencia();
    fixarNesteCulto();
    startTx(async () => {
      const r = await reabrirCronograma(eventId);
      if (r.ok) {
        showToast("Culto reaberto — o relógio voltou a correr.");
        router.refresh();
      } else {
        setEnded(endedAt);
        showToast(r.error);
      }
    });
  };

  // Ticar o último bloco NÃO encerra sozinho — só revela o botão verde "Tudo
  // concluído — encerrar culto" abaixo, que o líder toca quando quiser. Evita
  // encerrar por acidente enquanto se monta/testa a ordem.

  // Bloco em andamento sempre à vista: a régia (e o celular no bolso) precisa ver
  // ONDE o culto está sem procurar. Centraliza quando o bloco TROCA — não a cada
  // segundo, o que brigaria com quem rolou a tela pra conferir outra parte — e
  // nunca com a mão na massa (arraste/modal aberto). Reusa o mapa de refs que o
  // arraste já mantém.
  const blocoAtivoId = rows.find((r) => r.status === "live")?.it.id ?? null;

  /**
   * O PISO: o último índice que já é passado ou presente. Nada se move até aqui.
   *
   * É a resposta pra "quem fica ao vivo quando alguém reordena?" — e a resposta
   * só é simples porque o ao vivo é DERIVADO, não guardado: `liveIdx` é o
   * primeiro bloco sem `done_at` (rundown-timing). Se um bloco futuro pudesse
   * subir acima do ao vivo, ele passaria a ser o primeiro-sem-done e o culto
   * TELEPORTARIA pra ele — o monitor de palco trocaria e a ponte reiniciaria o
   * cronômetro, tudo isso como efeito colateral de arrastar um card.
   *
   * Com o piso, reordenar mexe só no FUTURO: `liveIdx` não pode mudar, e a
   * projeção de horários não anda pra trás (ela é ancorada nos `done_at`, que
   * ficam todos acima do piso). O caso real que motivou o modo continua
   * atendido: louvor ao vivo, palavra e oferta trocando de lugar abaixo dele.
   */
  const pisoIdx = rows.reduce((acc, r, i) => (r.status === "done" || r.status === "live" ? i : acc), -1);
  const podeMover = (id: string) => rows.findIndex((r) => r.it.id === id) > pisoIdx;
  // Espelhado em ref porque `onPointerMove` é um useCallback estável (deps []) e
  // não pode fechar sobre um valor que muda a cada render — mesma razão do
  // `listRef` logo acima.
  const pisoRef = useRef(pisoIdx);
  pisoRef.current = pisoIdx;
  useEffect(() => {
    if (!blocoAtivoId || !started || ended || ocupadoRef.current || tiqueNossoRef.current) return;
    itemRefs.current.get(blocoAtivoId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [blocoAtivoId, started, ended]);

  const remove = (id: string) =>
    startTx(async () => {
      const r = await removerBlocoCronograma(id, eventId);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  /**
   * O MENU DO CULTO — tudo que era ícone solto no cabeçalho, com rótulo.
   *
   * Primeiro o que só navega (escala, arquivos), depois, separado por um fio, o
   * que muda o estado do culto. Os dois destrutivos pedem pressão longa: a do
   * reiniciar porque ele não tem desfazer, e a do encerrar por decisão do André
   * depois de experimentar — "achei que o encerrar pode ter essa salvaguarda
   * também". Deslizar até eles destaca, mas não executa.
   */
  const itensMenu: ItemMenuCulto[] = [
    ...(escalaHref
      ? [{ id: "escala", rotulo: "Ver a escala", icone: <CalendarDays className="size-4 shrink-0" />, href: escalaHref }]
      : []),
    ...(filesUrl
      ? [
          {
            id: "arquivos",
            rotulo: "Arquivos do culto",
            detalhe: "Abre a pasta compartilhada",
            icone: <FolderOpen className="size-4 shrink-0" />,
            href: filesUrl,
            externo: true,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: "pasta",
            rotulo: filesUrl ? "Trocar a pasta de arquivos" : "Vincular pasta de arquivos",
            icone: <FolderPlus className="size-4 shrink-0" />,
            aoEscolher: () => setAbrirPasta(true),
          },
        ]
      : []),
    ...(canEdit && started && !ended
      ? [
          {
            id: "encerrar",
            rotulo: "Encerrar culto",
            detalhe: "dá pra reabrir depois",
            icone: <Square className="size-4 shrink-0 fill-current" />,
            destrutivo: true,
            segurar: true,
            desabilitado: emCarencia,
            aoEscolher: encerrar,
            separadorAntes: true,
          },
        ]
      : []),
    ...(canEdit && started
      ? [
          {
            id: "reiniciar",
            rotulo: "Reiniciar roteiro",
            detalhe: "apaga início, fim e os checks",
            icone: <RotateCcw className="size-4 shrink-0" />,
            segurar: true,
            desabilitado: emCarencia,
            aoEscolher: reset,
            separadorAntes: !(started && !ended),
          },
        ]
      : []),
  ];

  return (
    <section>
      {/* Cabeçalho: início → fim + total + relógio ao vivo.
          GRUDADO no topo: o relógio ao vivo e o botão de encerrar são justamente
          o que não pode sumir quando se rola a lista pra conferir um bloco lá
          embaixo. `bg-card` casa com o card que envolve o roteiro. */}
      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-card px-0.5 py-2">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold leading-tight">Ordem do culto</h3>
          {list.length > 0 ? (
            <p className="text-sm font-semibold tabular-nums text-muted-foreground">
              {fmt(startedMs ?? plannedStartMs)} → <span className={cn(overFinish && "text-warning-ink")}>{fmt(finishMs)}</span>
              <span className="font-normal"> · {totalMin} min</span>
            </p>
          ) : null}
        </div>
        {/* wrap continua ligado de propósito: em tela estreita o grupo "ao vivo"
            desce inteiro (ele é um flex próprio) em vez de vazar pra fora */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* O ícone fica no cabeçalho GRUDADO de propósito: é o sinal que
              sobrevive à rolagem. A faixa com o texto vem abaixo e rola junto,
              mas o ícone âmbar continua à vista dizendo "tem algo no monitor".
              É o ÚNICO que sobrou solto aqui — escala, arquivos e pasta viraram
              linhas com rótulo dentro do menu (pedido do André: "fica mais
              limpo"), o que de quebra aposenta a engrenagem, ícone que ninguém
              decifra sozinho. */}
          {canEdit ? <StageMessageButton ligado={!!stageMsg} onClick={() => setAbrirMsg(true)} /> : null}
          {list.length > 0 && started ? (
            // `select-none` no grupo todo: a seleção do iOS não respeita o
            // limite do botão — ela pegava o relógio ao lado junto.
            <div className="flex select-none items-center gap-1.5">
              <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5", ended ? "bg-success/12" : "bg-destructive/10")}>
                {ended ? null : <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />}
                {/* "Ao vivo" some no celular: o ponto pulsando já diz isso, e a
                    palavra custa ~65px — que faltam justamente quando o culto
                    passa de 1h e o relógio vira 1:02:34. Encerrado mantém o
                    rótulo, porque aí não há ponto pra falar por ele. */}
                <span
                  className={cn(
                    "text-[11px] font-extrabold uppercase tracking-wide",
                    ended ? "text-success-ink" : "hidden text-destructive-ink sm:inline",
                  )}
                >
                  {ended ? "Encerrado" : "Ao vivo"}
                </span>
                <span
                  className={cn(
                    "text-xl font-extrabold tabular-nums leading-none sm:text-2xl",
                    ended ? "text-success-ink" : "text-destructive-ink",
                  )}
                >
                  {clock((liveNow ?? startedMs ?? 0) - (startedMs ?? 0))}
                </span>
              </div>
            </div>
          ) : null}
          {list.length > 0 && !started && canEdit ? (
            // Sem `window.confirm`: o diálogo nativo aqui só treinava o dedo a
            // tocar "OK" sem ler, e não impediu nada em 09/08. Aqui o retorno
            // já é imediato por outro caminho — o `setStarted` otimista troca
            // este botão pelo relógio no mesmo quadro do toque, então não há
            // janela de "não aconteceu nada" pra pessoa querer tocar de novo.
            <button
              onClick={start}
              disabled={pendente || emCarencia}
              className="press inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-base font-extrabold text-primary-foreground disabled:opacity-60"
            >
              <Play className="size-5 fill-current" /> Iniciar culto
            </button>
          ) : null}
          {/* O menu existe SEMPRE — escala e arquivos não dependem do culto ter
              começado. O destrutivo mora aqui dentro, não solto na barra: o
              gatilho fica no lugar e as opções abrem pra baixo, longe do polegar
              (onde a varredura de progresso ficava escondida) e fora da
              coordenada do toque anterior. */}
          <MenuCulto itens={itensMenu} />
        </div>
      </div>

      {/* A porta de volta fica NO TOPO e não some sozinha: quem abre a tela dez
          minutos depois pode não ser quem errou, e precisa achar o caminho sem
          perguntar. Antes, um culto encerrado sumia do seletor inteiro — foi o
          que fez a Produção achar que o culto tinha sido apagado em 09/08. */}
      {canEdit && ended ? (
        <div className="mb-3">
          <FaixaEncerrado
            startedAt={started}
            endedAt={ended}
            algumTique={list.some((x) => x.doneAt)}
            aoReabrir={reabrir}
            ocupado={pendente}
          />
        </div>
      ) : null}

      {/* A faixa só existe quando há mensagem no ar. Uma faixa permanente
          dizendo "nada no monitor" seria ruído em 99% do tempo — e ruído
          constante é o que faz ninguém ver o aviso quando ele importa. */}
      {stageMsg ? (
        <div className="mb-3">
          <StageMessageStrip
            msg={stageMsg}
            eventId={eventId}
            podeMexer={canEdit}
            onAbrir={() => canEdit && setAbrirMsg(true)}
          />
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {canEdit ? "Monte a ordem do culto adicionando blocos abaixo." : "A ordem do culto ainda não foi montada."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map(({ it, startMs, endMs, status }, idx) => {
            const color = colorOf(it);
            const done = status === "done";
            const live = status === "live";
            const last = idx === rows.length - 1;
            // O realce (escala, giro, anel) aparece no instante em que o arraste
            // ARMA, não quando o dedo encosta. É o retorno que faltava: antes ele
            // acendia no toque, então acendia também em todo encostão que não
            // virava arraste — e quem estava só rolando a lista via o card pular.
            const reorderingThis = drag?.mode === "reorder" && drag.armado && drag.id === it.id;
            const durMs = it.durationMin * 60000;
            const elapsedMs = live ? (now != null ? now - startMs : 0) : done ? endMs - startMs : durMs;
            const overMs = Math.max(0, elapsedMs - durMs);
            // Negativo depois de estourar — é o que o bloco ao vivo mostra agora.
            const restanteMs = durMs - elapsedMs;
            const h: Heat = live ? heatOf(restanteMs) : done && overMs > 0 ? "red" : "normal";
            const liveRed = live && h === "red";
            return (
              <li
                key={it.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(it.id, el);
                  else itemRefs.current.delete(it.id);
                }}
                className="flex select-none items-stretch gap-1"
              >
                {/* ---- COLUNA 1: quando começa, e quanto dura ----------------
                    A duração subiu pra cá quando a alça da borda de baixo saiu:
                    sem o arraste, o número precisava virar o próprio controle.
                    O rótulo "agora" saiu daqui — ao vivo o card já ganha o anel
                    vinho, o nó fica vermelho e a coluna do contador acende
                    sozinha ("restam 4:32"). Com a duração empilhada não sobrava
                    linha, e três sinais de "ao vivo" já são dois a mais. Fica o
                    aviso pro leitor de tela, que não vê anel nenhum. */}
                <div className="flex w-10 shrink-0 flex-col items-end pt-2.5 text-right">
                  <span
                    className={cn(
                      "text-[13px] font-bold leading-none tabular-nums",
                      done
                        ? "text-muted-foreground line-through"
                        : liveRed
                          ? "text-destructive-ink"
                          : live
                            ? "text-primary"
                            : "text-foreground",
                    )}
                  >
                    {fmt(startMs)}
                  </span>
                  {live ? <span className="sr-only">Bloco ao vivo</span> : null}

                  {canEdit ? (
                    <DuracaoPopover
                      className="mt-1 w-full"
                      valor={it.durationMin}
                      rotuloBloco={it.title}
                      aberto={duracaoAberta === it.id}
                      onAbrir={() => setDuracaoAberta(it.id)}
                      onFechar={fecharDuracao}
                      onMudar={(min) => mudarDuracao(it.id, min)}
                      abrirPara="cima"
                      // h-9 = 36px, o piso de alvo do DESIGN.md, na largura toda
                      // da régua (40px) — dá 40×36 de área tocável num número.
                      // Pastilha (`bg-muted`): é o único controle novo da tela e
                      // ninguém adivinharia que se toca nela sem uma pista visual.
                      classeGatilho="mt-1 flex h-9 w-full items-center justify-center rounded-lg bg-muted text-[12.5px] font-bold leading-none text-foreground"
                    />
                  ) : (
                    <span className="mt-1 flex h-9 w-full items-center justify-center rounded-lg text-[12.5px] font-bold leading-none tabular-nums text-muted-foreground">
                      {it.durationMin}m
                    </span>
                  )}
                </div>

                {/* ---- COLUNA 2 (fina): a trilha do tempo + o contador --------
                    A trilha (linha + nó colorido) é o único lugar do celular onde
                    a cor do bloco aparece, e continua igual. Embaixo dela mora
                    agora o contador, que era o primeiro número DENTRO do card e
                    ali disputava a linha com o título. */}
                <div className="relative flex w-[54px] shrink-0 flex-col items-center pt-6">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1/2 top-0 w-px -translate-x-1/2 bg-border",
                      last ? "bottom-2.5" : "-bottom-2",
                    )}
                  />
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-2.5 size-2.5 -translate-x-1/2 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: liveRed ? "hsl(var(--destructive))" : color }}
                  />

                  {live ? (
                    /* AO VIVO: UM número, contando pra baixo, e o RÓTULO carrega
                       o sinal — "estourou 1:23" lê melhor que "restam −1:23". Na
                       régia, que não tem espaço pra rótulo, quem carrega é o
                       menos. Ver rundown-timing.ts § contagemRegressiva.
                       `z-10` + fundo: a linha da trilha (posicionada) pinta por
                       CIMA de texto não-posicionado sem isto — o contador ficava
                       riscado ao meio pela régua vertical. */
                    <div className="relative z-10 rounded bg-card px-0.5">
                      <Contador
                        label={restanteMs >= 0 ? "restam" : "estourou"}
                        value={clock(Math.abs(restanteMs))}
                        className={HEAT_TEXT[h]}
                      />
                    </div>
                  ) : done ? (
                    /* CONCLUÍDO segue PROGRESSIVO, e isso é decisão antiga e
                       deliberada: contagem regressiva de um bloco que já acabou
                       não quer dizer nada — o que interessa ali é quanto ele
                       realmente levou. Na coluna fina os dois números empilham
                       em vez de ficar lado a lado. */
                    <div className="relative z-10 flex flex-col items-center gap-1.5 rounded bg-card px-0.5">
                      <Contador label="corrido" value={clock(elapsedMs)} className="text-muted-foreground" />
                      {overMs > 0 ? (
                        <Contador label="passou" value={`+${clock(overMs)}`} className="text-destructive-ink" />
                      ) : null}
                    </div>
                  ) : null /* FUTURO: nada. A duração planejada agora mora na
                              coluna 1, e um "0:00" ou um travessão aqui seria
                              inventar informação. A coluna nunca fica visualmente
                              vazia — a trilha e o nó ocupam ela sempre. */}
                </div>

                {/* ---- COLUNA 3: o que é o bloco ---------------------------- */}
                <div
                  style={{ minHeight: ALTURA_BLOCO }}
                  onClick={() => {
                    if (drag || suppressClickRef.current) return;
                    if (canEdit) setEditing(it);
                    else if (canContribute) setContributing(it);
                  }}
                  className={cn(
                    "relative flex min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border bg-card transition-[box-shadow,transform,opacity,background-color]",
                    (canEdit || canContribute) && "cursor-pointer",
                    done && "opacity-55",
                    live && !liveRed && "border-primary shadow-[0_0_0_2px_hsl(var(--primary))]",
                    liveRed && "border-destructive bg-destructive/5 shadow-[0_0_0_2px_hsl(var(--destructive))]",
                    !live && "border-border",
                    reorderingThis && "z-30 scale-[1.04] rotate-1 opacity-95 shadow-2xl ring-2 ring-primary",
                    flashId === it.id && "animate-pop ring-2 ring-primary",
                  )}
                >
                  <div className="my-2.5 ml-3 min-w-0 flex-1 pr-1">
                    <p className={cn("font-semibold leading-tight", done && "line-through")}>{it.title}</p>
                    {/* O TIPO saiu da linha exibida (ago/2026): na Aliança ele é
                        quase sempre a MESMA palavra do título ("Louvor"/"Louvor"),
                        e repetir dobrado gastava a única linha de contexto. O campo
                        continua no banco e no modal do bloco, onde ele faz o
                        trabalho dele: dar nome padrão e a COR — que é como o tipo
                        aparece aqui, no nó da trilha. Sem responsável a linha não
                        existe: um travessão no celular é ruído (na régia ele fica,
                        porque célula de grade vazia parece defeito). */}
                    {it.responsible ? (
                      <p className="text-[12.5px] text-muted-foreground">{it.responsible}</p>
                    ) : null}
                    {/* A OBSERVAÇÃO JÁ ERA UMA LISTA — o celular é que a lia como frase.
                        Dado de produção: 10 das 13 observações têm quebra de linha, e o
                        conteúdo é exatamente lista — setlist ("Praise / Profetizo vida /
                        Nunca pare de lutar"), passagens ("Dt 1:21-33 / Nm 13:26-33"),
                        avisos. Sem `whitespace-pre-wrap` o HTML colapsa 
 em espaço, então
                        aqui saía "Praise Profetizo vida Nunca pare de lutar" numa linha só.
                        A régia já renderiza O MESMO CAMPO certo (rundown-columns.tsx:439);
                        era só o celular que não. O clamp segura a linha do bloco: uma
                        observação de seis linhas não pode empurrar o roteiro inteiro. */}
                    {it.note ? (
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">
                        {it.note}
                      </p>
                    ) : null}
                    {it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                      >
                        <ExternalLink className="size-3.5" /> Abrir link
                      </a>
                    ) : null}
                    {canContribute && !canEdit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContributing(it);
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                      >
                        <Plus className="size-3.5" /> {it.link || it.note ? "Editar link/info" : "Adicionar link/info"}
                      </button>
                    ) : null}
                  </div>

                  {/* ---- TRILHO DIREITO: tique em cima, alça embaixo ---------
                      O tique mudou de lado. Ele saiu da esquerda porque a leitura
                      do card começa no título, não num círculo vazio — e porque
                      a alça de reordenar já morava na direita: os dois controles
                      do bloco agora ficam no MESMO trilho, um sob o outro, em vez
                      de um em cada quina. Tique primeiro (é o gesto de todo
                      domingo), alça depois (é o de montar). */}
                  <div className="flex w-9 shrink-0 flex-col items-center gap-1 py-2">
                    {canEdit && done ? (
                      // DESMARCAR PEDE PRESSÃO, e não por capricho: desmarcar
                      // reabre o bloco, o `liveIdx` volta, e a ponte manda o
                      // ProPresenter reiniciar o cronômetro do palco — na frente
                      // de quem está pregando. Isso não pode sair de um toque no
                      // mesmo pixel do gesto que a equipe repete o culto inteiro.
                      // `BotaoSegurar` é o que o próprio roteiro já usa pra
                      // encerrar o culto; `aoDesistir` existe porque "dei um
                      // tapinha e não aconteceu nada" é o modo de falha dele.
                      <BotaoSegurar
                        aoConfirmar={() => desmarcarFeito(it)}
                        aoDesistir={() => showToast("Segure para desmarcar este bloco.")}
                        textoTeclado={`Desmarcar "${it.title}" como concluído?`}
                        aria-label="Segure para desmarcar feito"
                        // Só o clique: barrar o pointerdown aqui (mesmo em
                        // captura) mataria o gesto do próprio BotaoSegurar, que é
                        // quem escuta esse evento pra começar a varredura.
                        onClick={(e) => e.stopPropagation()}
                        className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-success bg-success text-white transition-colors"
                      >
                        <Check className="size-4" strokeWidth={3.5} />
                      </BotaoSegurar>
                    ) : canEdit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          marcarFeito(it);
                        }}
                        aria-label="Marcar feito"
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          live ? "border-primary text-primary" : "border-border text-transparent",
                        )}
                      >
                        <Check className="size-4" strokeWidth={3.5} />
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full",
                          done ? "bg-success text-white" : live ? "border-2 border-primary" : "border-2 border-border",
                        )}
                      >
                        {done ? <Check className="size-4" strokeWidth={3.5} /> : null}
                      </span>
                    )}

                    {canEdit && modo === "reordenar" && podeMover(it.id) ? (
                      /* AS SETAS. Elas não são enfeite de acessibilidade: são o
                         único caminho de teclado e de leitor de tela pra mover um
                         bloco, porque arraste não tem equivalente. E servem ao
                         dedo que prefere precisão a gesto. */
                      <div className="flex flex-col">
                        <button
                          onClick={(e) => { e.stopPropagation(); moverUma(it.id, -1); }}
                          aria-label={`Mover ${it.title} para cima`}
                          className="grid h-5 w-9 place-items-center rounded text-muted-foreground hover:bg-muted"
                        >
                          <ChevronUp className="size-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moverUma(it.id, 1); }}
                          aria-label={`Mover ${it.title} para baixo`}
                          className="grid h-5 w-9 place-items-center rounded text-muted-foreground hover:bg-muted"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>
                    ) : null}

                    {canEdit && modo === "reordenar" && podeMover(it.id) ? (
                      <button
                        onPointerDown={(e) => beginReorder(e, it)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Arrastar pra reordenar"
                        style={{ touchAction: "none" }}
                        className="grid size-9 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground/60 hover:bg-muted active:cursor-grabbing"
                      >
                        <GripVertical className="size-5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canEdit && started && !ended && allDone ? (
        <BotaoSegurar
          aoConfirmar={encerrar}
          textoTeclado="Encerrar o culto? Todos os blocos foram concluídos."
          className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-3 text-sm font-extrabold text-white"
        >
          <Check className="size-4" strokeWidth={3} /> Segure para encerrar o culto
        </BotaoSegurar>
      ) : null}

      {canEdit && modo === "reordenar" ? (
        /* O RODAPÉ DO MODO. "Pronto" é confirmação de saída, não de gravação —
           cada movimento já foi gravado quando aconteceu. Chamar de "Salvar"
           faria a pessoa achar que sair sem tocar desfaz, e não desfaz. */
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setModo("conduzir")}
            className="press flex-1 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
          >
            Pronto
          </button>
        </div>
      ) : null}

      {canEdit && modo === "conduzir" ? (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setEditing("new")}
            className="press flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 py-3 text-sm font-bold text-primary"
          >
            <Plus className="size-4" /> Adicionar bloco
          </button>
          <button
            onClick={() => setManageTpl(true)}
            aria-label="Modelos de cronograma"
            className="press grid w-12 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <LayoutTemplate className="size-5" />
          </button>
          <button
            onClick={() => setModo("reordenar")}
            aria-label="Reordenar blocos"
            className="press grid w-12 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <GripVertical className="size-5" />
          </button>
          <button
            onClick={() => setManageKinds(true)}
            aria-label="Gerenciar tipos"
            className="press grid w-12 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <Settings2 className="size-5" />
          </button>
        </div>
      ) : null}

      {editing ? (
        <BlocoModal
          eventId={eventId}
          item={editing === "new" ? null : editing}
          meId={meId}
          kinds={kinds}
          onManageKinds={() => setManageKinds(true)}
          onDelete={editing !== "new" ? () => remove((editing as RundownItem).id) : undefined}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {contributing ? (
        <ContribuirModal item={contributing} meId={meId} onClose={() => setContributing(null)} />
      ) : null}

      {manageKinds ? <KindsManager kinds={kinds} onClose={() => setManageKinds(false)} /> : null}

      {abrirPasta ? (
        <PastaModal eventId={eventId} url={filesUrl} onClose={() => setAbrirPasta(false)} />
      ) : null}

      <StageMessageSheet
        open={abrirMsg}
        onClose={() => setAbrirMsg(false)}
        eventId={eventId}
        msg={stageMsg}
        atalhos={stageAtalhos}
      />

      {manageTpl ? (
        <TemplatesManager
          eventId={eventId}
          templates={templates}
          currentItems={list.map((it) => ({
            kind: it.kind,
            title: it.title,
            color: it.color,
            durationMin: it.durationMin,
            note: it.note,
          }))}
          onClose={() => setManageTpl(false)}
        />
      ) : null}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Modal do bloco — tipo primeiro, nome já preenchido
// -----------------------------------------------------------------------------
const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

// -----------------------------------------------------------------------------
// Modal de CONTRIBUIÇÃO — voluntário escalado só adiciona link/observação
// -----------------------------------------------------------------------------
function ContribuirModal({
  item,
  meId,
  onClose,
}: {
  item: RundownItem;
  meId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [link, setLink] = useState(item.link ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [error, setError] = useState<string | null>(null);
  useMarcaDeEdicao(item.id);
  const outro = quemEstaEditando(item, meId);

  const save = () => {
    setError(null);
    startTx(async () => {
      // Manda a versão que ESTE modal leu: se alguém salvou no meio, a ação
      // recusa e diz quem foi, em vez de apagar o que a pessoa escreveu.
      const r = await contribuirNoBloco(item.id, link, note, item.contentUpdatedAt);
      if (r.ok) {
        onClose();
        router.refresh();
        showToast(warm("blocoSalvo"));
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title={item.title}>
      <div className="mt-1 space-y-4">
        {outro ? <AvisoDeEdicao nome={outro} /> : null}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Link (opcional)</span>
          <input className={inputCls} placeholder="YouTube, Drive, letra…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Observação (opcional)</span>
          <textarea rows={2} className={cn(inputCls, "resize-none")} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
        <button
          onClick={save}
          disabled={pending}
          className="press h-[52px] w-full rounded-[15px] bg-primary text-[15.5px] font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Exportado porque a régia (`rundown-columns.tsx`) edita bloco com ESTE mesmo
 * modal. Duas telas de edição divergiriam — e a trava por versão da 0048 só
 * funciona se as duas mandarem o `contentUpdatedAt` do mesmo jeito.
 */
export function BlocoModal({
  eventId,
  item,
  meId,
  kinds,
  onManageKinds,
  onDelete,
  onClose,
}: {
  eventId: string;
  item: RundownItem | null;
  meId: string;
  kinds: RundownKind[];
  /** Ausente na régia: gerenciar tipos é coisa de montar roteiro, não de conduzir. */
  onManageKinds?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [kind, setKind] = useState(item?.kind ?? "");
  const [color, setColor] = useState(item?.color ?? null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [duration, setDuration] = useState(String(item?.durationMin ?? 5));
  const [responsible, setResponsible] = useState(item?.responsible ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [error, setError] = useState<string | null>(null);
  useMarcaDeEdicao(item?.id ?? null);
  const outro = item ? quemEstaEditando(item, meId) : null;

  const pickKind = (k: RundownKind) => {
    setKind(k.label);
    setColor(k.color);
    // Preenche o nome com o tipo se ainda estiver vazio ou igual ao tipo anterior.
    if (!title.trim() || title.trim() === kind.trim()) setTitle(k.label);
  };

  const save = () => {
    setError(null);
    startTx(async () => {
      const input = {
        title: title.trim() || kind,
        kind: kind || "Outro",
        color: color ?? undefined,
        durationMin: Number(duration) || 0,
        responsible,
        note,
        link,
      };
      const r = item
        ? // a versão lida ao abrir: quem salvou primeiro ganha, o segundo é avisado
          await atualizarBlocoCronograma(item.id, eventId, input, item.contentUpdatedAt)
        : await adicionarBlocoCronograma(eventId, input);
      if (r.ok) {
        onClose();
        router.refresh();
        showToast(warm("blocoSalvo"));
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title={item ? "Editar bloco" : "Novo bloco"}>
      <div className="mt-1 space-y-4">
        {outro ? <AvisoDeEdicao nome={outro} /> : null}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-medium">Tipo</p>
            {onManageKinds ? (
              <button onClick={onManageKinds} className="press-sm inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
                <Settings2 className="size-3.5" /> Gerenciar
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => pickKind(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
                  kind === k.label ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: k.color }} /> {k.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome do bloco</span>
          <input
            className={inputCls}
            placeholder="Ex.: Louvor de entrada"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium">Duração (min)</span>
            <input type="number" inputMode="numeric" min={1} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className="flex-[2]">
            <span className="mb-1 block text-sm font-medium">Quem faz (opcional)</span>
            <input className={inputCls} placeholder="Ex.: Banda / Pr. João" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Observação (opcional)</span>
          <textarea rows={2} className={cn(inputCls, "resize-none")} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Link (opcional)</span>
          <input className={inputCls} placeholder="YouTube, Drive, letra…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
        <button
          onClick={save}
          disabled={pending || (!title.trim() && !kind)}
          className={cn(
            "press h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold",
            title.trim() || kind ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {pending ? "Salvando…" : item ? "Salvar" : "Adicionar"}
        </button>
        {onDelete ? (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            disabled={pending}
            className="press-sm inline-flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-destructive-ink"
          >
            <Trash2 className="size-4" /> Remover bloco
          </button>
        ) : null}
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Gerenciar tipos (por igreja)
// -----------------------------------------------------------------------------
function KindsManager({ kinds, onClose }: { kinds: RundownKind[]; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);

  const add = () =>
    startTx(async () => {
      const r = await adicionarTipoBloco(label, color);
      if (r.ok) {
        setLabel("");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  const del = (id: string) =>
    startTx(async () => {
      const r = await removerTipoBloco(id);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title="Tipos de bloco">
      <div className="mt-1 space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Os tipos são da igreja toda. Remover um tipo não altera blocos já criados.
        </p>
        <ul className="flex flex-col gap-1.5">
          {kinds.map((k) => (
            <li key={k.id} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2">
              <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: k.color }} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{k.label}</span>
              <button
                onClick={() => del(k.id)}
                disabled={pending}
                aria-label={`Remover ${k.label}`}
                className="press-sm grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive-ink"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Novo tipo</p>
          <input
            className={inputCls}
            placeholder="Nome do tipo (ex.: Batismo)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                style={{ backgroundColor: c }}
                className={cn("size-7 rounded-full", color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "")}
              />
            ))}
          </div>
          <button
            onClick={add}
            disabled={pending || label.trim().length < 1}
            className="press h-11 w-full rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Adicionando…" : "Adicionar tipo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Modelos de cronograma (presets de blocos)
// -----------------------------------------------------------------------------
type TplItem = { kind: string; title: string; color: string | null; durationMin: number; note: string | null };

function TemplatesManager({
  eventId,
  templates,
  currentItems,
  onClose,
}: {
  eventId: string;
  templates: RundownTemplate[];
  currentItems: TplItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTx] = useTransition();
  const [name, setName] = useState("");

  const apply = (id: string) =>
    startTx(async () => {
      const r = await aplicarModeloCronograma(eventId, id);
      if (r.ok) {
        showToast("Modelo aplicado — é só ajustar 🙌");
        onClose();
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  const save = () =>
    startTx(async () => {
      const r = await salvarModeloCronograma(name, currentItems);
      if (r.ok) {
        showToast("Modelo salvo ✨");
        setName("");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });
  const del = (id: string) =>
    startTx(async () => {
      const r = await excluirModeloCronograma(id);
      if (r.ok) router.refresh();
      else showToast(r.error);
    });

  return (
    <Modal open onClose={() => !pending && onClose()} sheet title="Modelos de cronograma">
      <div className="mt-1 space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Usar um modelo</p>
          {templates.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nenhum modelo ainda. Monte um cronograma e salve como modelo abaixo pra reaproveitar.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
                  <button
                    onClick={() => apply(t.id)}
                    disabled={pending}
                    className="press-sm min-w-0 flex-1 text-left disabled:opacity-60"
                  >
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {t.items.length} bloco{t.items.length === 1 ? "" : "s"} ·{" "}
                      {t.items.reduce((s, i) => s + (i.durationMin || 0), 0)} min
                    </p>
                  </button>
                  <button
                    onClick={() => del(t.id)}
                    disabled={pending}
                    aria-label={`Excluir ${t.name}`}
                    className="press-sm grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive-ink"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Salvar o cronograma atual como modelo</p>
          <input
            className={inputCls}
            placeholder="Nome (ex.: Culto de Domingo)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={save}
            disabled={pending || name.trim().length < 1 || currentItems.length === 0}
            className="press h-11 w-full rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar como modelo"}
          </button>
          {currentItems.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Adicione blocos primeiro pra poder salvar.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
