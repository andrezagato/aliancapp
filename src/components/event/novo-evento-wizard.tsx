"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, LayoutTemplate } from "lucide-react";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { useToast } from "@/components/ui/toast";
import { useEventModal } from "@/components/event/event-modal-provider";
import { criarEventoAvulso } from "@/lib/actions";
import { warm } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import type { TeamWithPositions, EventTemplate } from "@/lib/data";

const inputCls =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const dataCls = cn(inputCls, "text-[15px] font-bold tabular-nums");

/**
 * ALTURA ÚNICA dos três passos, e por isso um número e não `auto`.
 *
 * O Modal é ancorado embaixo (`items-end`, modal.tsx:174): um passo mais alto
 * que o outro faz o sheet SALTAR na troca — foi o incômodo que o
 * `people-controls.tsx` resolveu com esta mesma receita. E aqui os três passos
 * são bem diferentes: 2 modelos, 5 campos, 8 equipes.
 *
 * O número: num iPhone SE (667px) o sheet tem 88dvh = 587px; tirando alça +
 * título (~70), a trilha de passos (~40) e o rodapé fixo (~92), sobram ~385px.
 * Daí 52vh (347px lá) — e não os 58vh do people-controls, que não tem rodapé.
 * `vh` e não `dvh`: o passo 2 é todo campo de texto, e `dvh` encolhe quando o
 * teclado do iOS abre — o painel desabaria no meio da digitação.
 * `overflow-hidden` é obrigatório: o painel que entra começa em translateX(±100%)
 * e sem o corte o sheet (que é overflow-y-auto) ganharia barra horizontal.
 *
 * O terceiro termo é o TETO contra a viewport de verdade: o sheet é limitado por
 * `88dvh` (modal.tsx), e a mistura `vh`/`dvh` é o que faz o rodapé cair abaixo da
 * dobra no Safari com as barras à mostra. 236 = o cromo medido (alça 35, trilha
 * 32, título 27,5, paddings e o rodapé de 52) com uma folga.
 */
const ALTURA = "h-[min(52vh,420px,calc(88dvh-236px))]";

type Passo = 1 | 2 | 3;
const NOMES: Record<Passo, string> = {
  1: "De onde partir",
  2: "Quando e onde",
  3: "Quem serve",
};

/** Vem inteiro de `novo-evento-form.tsx:28-33` — o palpite de data que serve
 *  numa igreja: o próximo domingo. */
function proximoDomingoISO(): string {
  const d = new Date();
  const dia = d.getDay();
  d.setDate(d.getDate() + (dia === 0 ? 7 : 7 - dia));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Criar evento em 3 passos, num sheet — não é mais página (/escalas/novo virou
 * porta de entrada). A ordem é decisão do dono e tem razão: o modelo já traz
 * horário e equipes prontos, então perguntar "de onde partir" primeiro poupa os
 * outros dois passos inteiros.
 */
export function NovoEventoWizard({
  open,
  onClose,
  teams,
  templates,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  teams: TeamWithPositions[];
  templates: EventTemplate[];
  /** Data já escolhida (o dia tocado no calendário) — "YYYY-MM-DD". */
  initialDate?: string | null;
}) {
  const router = useRouter();
  const modal = useEventModal();
  const { showToast } = useToast();
  const [pending, start] = useTransition();

  // O passo 1 SEMPRE existe — é a única porta pro gerenciador de modelos
  // (/modelos) desde que /escalas/novo virou redirect. Pular pro passo 2
  // fecharia essa porta pra quem ainda não tem modelo salvo.
  const primeiro: Passo = 1;
  const [passo, setPasso] = useState<Passo>(primeiro);
  const [anim, setAnim] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(proximoDomingoISO());
  const [time, setTime] = useState("18:00");
  const [callTime, setCallTime] = useState("");
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Toda abertura começa em folha em branco. Sem isto, criar dois eventos
  // seguidos faria o segundo nascer com o título do primeiro.
  useEffect(() => {
    if (!open) return;
    setPasso(primeiro);
    setAnim(undefined);
    setTitle("");
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(initialDate ?? "") ? initialDate! : proximoDomingoISO());
    setTime("18:00");
    setCallTime("");
    setLocation("");
    setSelected(new Set());
  }, [open, initialDate, primeiro]);

  // Mesmo mecanismo do people-controls.tsx:110-114: a direção da animação sai da
  // comparação dos passos, e o `key` no filho é o que replica a animação.
  const ir = (p: Passo) => {
    setAnim(p > passo ? "animate-push" : "animate-pull");
    setPasso(p);
  };

  function aplicarModelo(t: EventTemplate) {
    setTitle(t.title);
    if (t.startTime) setTime(t.startTime.slice(0, 5));
    setCallTime(t.callTime ? t.callTime.slice(0, 5) : "");
    setLocation(t.location ?? "");
    setSelected(new Set(t.teams.map((x) => x.id)));
    ir(2);
  }

  const alternar = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const podeAvancar =
    title.trim().length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  const podeCriar = selected.size > 0;

  function criar() {
    start(async () => {
      const r = await criarEventoAvulso({
        title,
        date,
        time,
        callTime: callTime || undefined,
        location,
        teamIds: [...selected],
      });
      if (!r.ok) {
        // Erro por toast, não por linha no sheet: uma linha nova mudaria a
        // altura, que é justamente o que este wizard existe pra não fazer.
        showToast(r.error);
        return;
      }
      showToast(warm("eventoCriado"));
      onClose();
      router.refresh();
      // A página antiga fazia `router.push('/escalas/'+id)`, que só servia pra
      // abrir o modal da escala do outro lado. Aqui a gente abre o modal direto:
      // um carregamento a menos, e a pessoa continua onde estava.
      if (r.eventId) {
        if (modal) modal.abrirEscala(r.eventId);
        else router.push(`/escalas/${r.eventId}`);
      }
    });
  }

  const rodape =
    passo === 1
      ? { rotulo: "Começar do zero", ativo: true, acao: () => ir(2), variante: "outline" as const }
      : passo === 2
        ? { rotulo: "Continuar", ativo: podeAvancar, acao: () => ir(3), variante: "cheio" as const }
        : {
            rotulo: pending ? "Criando…" : "Criar evento",
            ativo: podeCriar && !pending,
            acao: criar,
            variante: "cheio" as const,
          };

  return (
    <Modal open={open} onClose={() => !pending && onClose()} sheet title="Novo evento">
      <div className="space-y-3 pt-1">
        {/* Altura CONSTANTE: o voltar fica INVISÍVEL no passo 1, não ausente. O
            `onBack` do Modal é um bloco a mais acima do título e faria o sheet
            crescer 32px na troca de passo — exatamente o salto que este wizard
            existe pra não ter. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => ir((passo - 1) as Passo)}
            disabled={passo === primeiro}
            aria-label={passo > primeiro ? `Voltar para ${NOMES[(passo - 1) as Passo]}` : undefined}
            className="press-sm -ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-primary disabled:invisible"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex gap-1.5" aria-hidden>
              {([1, 2, 3] as Passo[]).map((p) => (
                <span key={p} className={cn("h-1 flex-1 rounded-full", p <= passo ? "bg-primary" : "bg-border")} />
              ))}
            </div>
            <p className="mt-1.5 text-[12.5px] font-medium text-muted-foreground">
              Passo {passo} de 3 · {NOMES[passo]}
            </p>
          </div>
        </div>

        <div className={cn(ALTURA, "overflow-hidden")}>
          <div key={passo} className={cn("h-full overflow-y-auto overscroll-contain pr-0.5", anim)}>
            {passo === 1 ? <PassoModelo templates={templates} onEscolher={aplicarModelo} /> : null}
            {passo === 2 ? (
              <PassoQuando
                title={title} setTitle={setTitle}
                date={date} setDate={setDate}
                time={time} setTime={setTime}
                callTime={callTime} setCallTime={setCallTime}
                location={location} setLocation={setLocation}
              />
            ) : null}
            {passo === 3 ? <PassoEquipes teams={teams} selected={selected} onToggle={alternar} /> : null}
          </div>
        </div>

        {/* RODAPÉ FIXO: um botão só, mesma altura, nos três passos. */}
        <button
          type="button"
          onClick={rodape.acao}
          disabled={!rodape.ativo}
          className={cn(
            "press h-12 w-full rounded-full text-[15px] font-extrabold",
            !rodape.ativo
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : rodape.variante === "outline"
                ? "border border-border bg-card text-foreground"
                : "bg-primary text-primary-foreground",
          )}
        >
          {rodape.rotulo}
        </button>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// PASSO 1 — de onde partir
// -----------------------------------------------------------------------------
function PassoModelo({
  templates,
  onEscolher,
}: {
  templates: EventTemplate[];
  onEscolher: (t: EventTemplate) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {templates.length > 0
          ? "O modelo já traz o horário e as equipes preenchidos — daí ele vem primeiro."
          : "Nenhum modelo salvo ainda. Toque em “Começar do zero” aqui embaixo, ou salve um modelo pra não repetir horário e equipes toda semana."}
      </p>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onEscolher(t)}
          className="press-sm flex w-full items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3.5 text-left hover:border-primary/40"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <LayoutTemplate className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{t.title}</span>
            <span className="block text-[12.5px] text-muted-foreground">
              {t.teams.length} equipe{t.teams.length === 1 ? "" : "s"}
              {t.startTime ? ` · ${t.startTime.slice(0, 5)}` : ""}
            </span>
          </span>
        </button>
      ))}
      {/* ÚNICA porta pro gerenciador de modelos depois que /escalas/novo virou
          redirect — era ele que levava lá. Sem isto, /modelos fica inalcançável
          de dentro do app. */}
      <Link
        href="/modelos"
        className="press-sm mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-[12.5px] font-medium text-muted-foreground"
      >
        <LayoutTemplate className="size-4" /> Gerenciar modelos
      </Link>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PASSO 2 — quando e onde
// -----------------------------------------------------------------------------
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function PassoQuando(p: {
  title: string; setTitle: (v: string) => void;
  date: string; setDate: (v: string) => void;
  time: string; setTime: (v: string) => void;
  callTime: string; setCallTime: (v: string) => void;
  location: string; setLocation: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Campo label="Título">
        <input className={inputCls} value={p.title} onChange={(e) => p.setTitle(e.target.value)} placeholder="Ex.: Culto de Domingo" />
      </Campo>
      <div className="flex gap-2">
        <Campo label="Data">
          <input type="date" className={dataCls} value={p.date} onChange={(e) => p.setDate(e.target.value)} />
        </Campo>
        <Campo label="Horário">
          <input type="time" className={dataCls} value={p.time} onChange={(e) => p.setTime(e.target.value)} />
        </Campo>
      </div>
      <Campo label="Chegada da equipe (call) — opcional">
        <input type="time" className={dataCls} value={p.callTime} onChange={(e) => p.setCallTime(e.target.value)} />
      </Campo>
      <Campo label="Local">
        <input className={inputCls} value={p.location} onChange={(e) => p.setLocation(e.target.value)} placeholder="Ex.: Templo" />
      </Campo>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PASSO 3 — quem serve
// -----------------------------------------------------------------------------
function PassoEquipes({
  teams,
  selected,
  onToggle,
}: {
  teams: TeamWithPositions[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Cada líder monta a escala da própria equipe (posições e quantas pessoas) depois, na tela do evento.
      </p>
      {teams.map((team) => {
        const on = selected.has(team.id);
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => onToggle(team.id)}
            aria-pressed={on}
            className={cn(
              "press-sm flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors",
              on ? "bg-primary/5 ring-1 ring-primary" : "bg-muted/30 hover:bg-muted/60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
              )}
            >
              {on ? <Check className="size-3.5" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <TeamDot color={team.color} /> {team.name}
              </p>
              {team.positions.length > 0 ? (
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                  Posições: {team.positions.map((x) => x.name).join(", ")}
                </p>
              ) : (
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Sem posições cadastradas ainda</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
