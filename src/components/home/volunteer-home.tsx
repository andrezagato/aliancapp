"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { useEventModal } from "@/components/event/event-modal-provider";
import { ReactiveHeader } from "@/components/app-shell/reactive-header";
import { PullToRefresh } from "@/components/app-shell/pull-to-refresh";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { churchDateISO, fmtEventWhen } from "@/lib/format";
import type { MyAssignment } from "@/lib/data";
import {
  confirmarEscalacao,
  recusarEscalacao,
  fazerCheckin,
  pedirTroca,
  listMembrosParaTroca,
} from "@/lib/actions";
import { AchievementCelebration } from "@/components/achievement-celebration";
import { getCoords } from "@/lib/geo-client";
import { warm } from "@/lib/toasts";
import { markSeen } from "@/lib/achievements-seen";
import type { UnlockedBadge } from "@/lib/achievements";
import { TodayCard } from "./today-card";
import { CultoAoVivo } from "./culto-ao-vivo";
import { NextScheduleHero } from "./next-schedule-hero";
import { SwipeCard } from "./swipe-card";
import { PendingInviteBanner } from "./pending-invite-banner";

const REASONS = ["Viajando", "Trabalho", "Saúde", "Compromisso", "Outro"];
type Sub = { profileId: string; name: string; avatarUrl: string | null; recusouAntes: boolean };

export function VolunteerHome({
  title,
  subtitle,
  userName,
  unread = 0,
  assignments,
  aoVivo,
  children,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  unread?: number;
  assignments: MyAssignment[];
  /**
   * O culto que está acontecendo agora. Chega como DADO, não como elemento
   * pronto, e isso é o ponto: só aqui dentro dá pra saber se ele já está na tela.
   * O corte today/herói/lista acontece no cliente (logo abaixo), então o servidor
   * não tem como deduplicar — e um slot de elemento obrigaria a mover aquela
   * derivação inteira pra lá.
   */
  aoVivo?: { eventId: string; title: string; startedAt: string } | null;
  children?: React.ReactNode;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(assignments);
  useEffect(() => setItems(assignments), [assignments]);

  const [celebrate, setCelebrate] = useState<UnlockedBadge[]>([]);
  const celebrateNew = (u: UnlockedBadge[]) => {
    markSeen(u.map((b) => b.code));
    setCelebrate(u);
  };

  // sheet único de resposta — confirmar OU recusar uma escala
  const eventModal = useEventModal();
  const [respond, setRespond] = useState<MyAssignment | null>(null);
  const [reason, setReason] = useState("");
  const [subOpen, setSubOpen] = useState(false);
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Sub | null>(null);

  const patch = (id: string, changes: Partial<MyAssignment>) =>
    setItems((prev) => prev.map((a) => (a.assignmentId === id ? { ...a, ...changes } : a)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((a) => a.assignmentId !== id));

  const confirm = (a: MyAssignment) => {
    patch(a.assignmentId, { status: "confirmado" });
    showToast(warm("presencaConfirmada"));
    startTransition(async () => {
      const r = await confirmarEscalacao(a.assignmentId);
      if (!r.ok) {
        patch(a.assignmentId, { status: "convidado" });
        showToast(r.error);
      } else if (r.unlocked && r.unlocked.length > 0) {
        celebrateNew(r.unlocked);
      }
    });
  };

  // CHECK-IN EM VOO — a trava que faltava, e ela precisa ser PRÓPRIA.
  //
  // O botão não tinha estado de espera nenhum: `const [, startTransition]`
  // descarta a flag `pending`, e entre o toque e qualquer mudança na tela roda o
  // `getCoords` (timeout de 6s, alta precisão, mais o alerta nativo de permissão
  // do iOS na primeira vez) e só então o `fazerCheckin`. Nesse intervalo a tela
  // não mudava NADA e o botão continuava vivo — então a pessoa tocava de novo, no
  // mesmo pixel. O segundo toque disparava um segundo pedido de GPS e um segundo
  // `fazerCheckin`; o INSERT duplicado morre no `unique` de `checkins`, mas o
  // `logActivity` grava duas vezes e o `notificarConquistas` roda duas vezes em
  // paralelo (dois pushes, duas telas de conquista). E no ramo "fora do local",
  // o segundo toque empilhava um `window.confirm` em cima do primeiro.
  //
  // Por que NÃO reusar a flag do `useTransition`: ela é uma só pra todas as
  // transições deste componente — confirmar escala, recusar, carregar substitutos.
  // Usá-la aqui desabilitaria o check-in enquanto qualquer outra coisa estivesse
  // no ar, o que é uma trava mais larga que o problema.
  const [checkinEmVoo, setCheckinEmVoo] = useState<string | null>(null);

  const doCheckin = (a: MyAssignment, force = false) => {
    setCheckinEmVoo(a.assignmentId);
    startTransition(async () => {
      const coords = await getCoords();
      const r = await fazerCheckin(a.assignmentId, a.teamId, a.eventId, coords?.lat ?? null, coords?.lng ?? null, force);
      if (r.ok) {
        patch(a.assignmentId, { checkedIn: true });
        setCheckinEmVoo(null);
        showToast(warm("checkin"));
        if (r.unlocked && r.unlocked.length > 0) celebrateNew(r.unlocked);
      } else if (r.code === "outside") {
        if (typeof window !== "undefined" && window.confirm("Você não está no local do evento. Fazer check-in mesmo assim?")) {
          // Segue em voo de propósito: a chamada recursiva reassume a trava, e
          // soltar aqui reabriria o botão exatamente no intervalo do segundo GPS.
          doCheckin(a, true);
        } else {
          setCheckinEmVoo(null);
        }
      } else {
        setCheckinEmVoo(null);
        showToast(r.error);
      }
    });
  };
  const checkin = (a: MyAssignment) => doCheckin(a);

  const openRespond = (a: MyAssignment) => {
    setRespond(a);
    setReason("");
    setSelectedSub(null);
    setSubOpen(false);
    setSubs(null);
  };
  const closeRespond = () => setRespond(null);

  const confirmFromModal = () => {
    if (!respond) return;
    confirm(respond);
    closeRespond();
  };

  const loadSubs = () => {
    if (!respond) return;
    setSubOpen(true);
    if (subs) return;
    setSubLoading(true);
    startTransition(async () => {
      const list = await listMembrosParaTroca(respond.teamId, respond.assignmentId);
      setSubs(list);
      setSubLoading(false);
    });
  };

  const submitDecline = () => {
    if (!respond || reason.trim().length < 3) return;
    const id = respond.assignmentId;
    const sub = selectedSub;
    const motivo = reason.trim();
    closeRespond();
    if (sub) {
      showToast(warm("trocaPedida"));
      startTransition(async () => {
        const r = await pedirTroca(id, motivo, sub.profileId);
        if (!r.ok) showToast(r.error);
      });
    } else {
      removeItem(id);
      showToast(warm("presencaRecusada"));
      startTransition(async () => {
        const r = await recusarEscalacao(id, motivo);
        if (!r.ok) {
          showToast(r.error);
          router.refresh();
        }
      });
    }
  };

  // O DIA DA IGREJA PRECISA SER RECONFERIDO QUANDO A PESSOA VOLTA PRO APP.
  //
  // `todaySP` é calculado no render, e nada obriga um render a acontecer. Num PWA
  // instalado na tela de início — que é como a igreja usa — o app não fecha: fica
  // suspenso no alternador de tarefas por dias. Quem abriu no domingo à noite e
  // reabre na segunda de manhã pelo alternador não dispara render nenhum, e a
  // tela segue dizendo "É HOJE", com botão de check-in vivo, pro culto de ONTEM.
  //
  // Só `visibilitychange` e `focus`, sem cronômetro: o caso real é justamente o
  // do app voltando do bolso, e um intervalo re-renderizaria a Home inteira pra
  // sempre pra cobrir a virada de meia-noite com o app aberto e olhando — que não
  // é o problema que alguém relatou. E só re-renderiza se o dia REALMENTE virou.
  const [, reconferirDia] = useState(0);
  const diaRef = useRef<string | null>(null);
  useEffect(() => {
    const conferir = () => {
      const agora = churchDateISO(new Date().toISOString());
      if (diaRef.current !== null && agora !== diaRef.current) reconferirDia((n) => n + 1);
      diaRef.current = agora;
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", conferir);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", conferir);
    };
  }, []);

  // convites pendentes sobem pro topo; o resto (confirmado/presente) vira today/hero/lista
  const todaySP = churchDateISO(new Date().toISOString());
  diaRef.current = todaySP;
  const sorted = [...items].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));

  const pending = sorted.filter((a) => a.status === "convidado");
  const rest = sorted.filter((a) => a.status !== "convidado");
  // QUAL ESCALA DE HOJE O CARD MOSTRA — e por que não é simplesmente a primeira.
  //
  // Era `rest.find(...)`, ou seja a primeira do dia em ordem cronológica. Quem
  // serve de manhã E de noite (acontece toda semana na Mídias) via o card preso
  // na escala da MANHÃ o dia inteiro — e o único botão de check-in da tela
  // pertencia a ela. À noite, a pessoa tocava nele achando que marcava presença
  // no culto da noite e gravava presença no da manhã, que já tinha acabado.
  //
  // Agora o card mostra a primeira de hoje AINDA NÃO marcada: o botão sempre
  // pertence a um compromisso que a pessoa ainda tem pela frente. Marcou a da
  // manhã, o card passa pra da noite, que é de fato o próximo compromisso dela
  // no dia.
  //
  // E se todas já estiverem marcadas, mostra a ÚLTIMA em vez de nenhuma: o card
  // some seria "nada some da tela" ao contrário, e o "Presente" é justamente a
  // confirmação que a pessoa quer continuar vendo.
  const deHoje = rest.filter((a) => churchDateISO(a.startsAt) === todaySP);
  const today = deHoje.find((a) => !a.checkedIn) || deHoje[deHoje.length - 1] || null;
  const upcoming = rest.filter((a) => a !== today);
  const hero = upcoming[0] || null;
  const list = upcoming.slice(1);
  const nothing = pending.length === 0 && !today && !hero && list.length === 0;

  // O CULTO AO VIVO SÓ SOBE SE ELE JÁ NÃO ESTIVER NA TELA.
  //
  // A comparação é contra os TRÊS lugares onde uma escala aparece, não só contra
  // o `today`. Quem serve de manhã e de noite tem `today` = a escala da MANHÃ
  // (`rest.find` pega a primeira do dia) enquanto o culto ao vivo é o da NOITE —
  // que está no `hero`. Conferindo só o `today`, o mesmo culto apareceria duas
  // vezes, um card abaixo do outro.
  const jaNaTela =
    !!aoVivo &&
    (today?.eventId === aoVivo.eventId ||
      hero?.eventId === aoVivo.eventId ||
      list.some((a) => a.eventId === aoVivo.eventId));
  const mostrarAoVivo = aoVivo && !jaNaTela;

  // abre o modal da escala em cima da Home — antes isso era router.push e
  // mudava de aba
  const open = (id: string) =>
    eventModal ? eventModal.abrirEscala(id) : router.push(`/escalas/${id}`);
  const isPending = respond?.status === "convidado";

  return (
    <>
      <ReactiveHeader title={title} subtitle={subtitle} userName={userName} unread={unread} />
      <div aria-hidden style={{ height: "calc(env(safe-area-inset-top) + 5rem)" }} />

      <PullToRefresh>
        <div className="space-y-3">
          <PendingInviteBanner pending={pending} onRespond={openRespond} />

          {/* AGORA -> PRÓXIMA -> A SEGUINTE. O card do culto ao vivo era o
              primeiro dos `children`, e os children são renderizados DEPOIS do
              herói e da lista — então o culto que estava acontecendo nascia em
              sexto lugar na página, abaixo de escalas de semanas à frente.
              Nas Home de líder e admin ele já era o primeiro filho da HomeShell;
              a queixa era exclusiva do voluntário, porque só esta tela desenha
              conteúdo próprio antes dos children. */}
          {mostrarAoVivo ? (
            <CultoAoVivo eventId={aoVivo.eventId} title={aoVivo.title} startedAt={aoVivo.startedAt} />
          ) : null}

          {nothing ? <EmptyCard /> : null}
          {today ? (
            <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
              <TodayCard a={today} onConfirm={() => confirm(today)} onCancel={() => openRespond(today)} onCheckin={() => checkin(today)} checkinEmVoo={checkinEmVoo === today.assignmentId} />
            </div>
          ) : null}
          {hero ? (
            <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
              <NextScheduleHero a={hero} onConfirm={() => confirm(hero)} onCancel={() => openRespond(hero)} onOpen={() => open(hero.eventId)} />
            </div>
          ) : null}

          {list.length > 0 ? (
            <section className="animate-fade-up" style={{ animationDelay: "150ms" }}>
              <div className="flex items-baseline justify-between px-1 pb-1.5">
                <h3 className="font-display text-lg font-bold text-foreground">Depois disso</h3>
                <span className="text-xs font-semibold text-muted-foreground">Arraste p/ responder</span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-card shadow-soft">
                {list.map((a) => (
                  <SwipeCard
                    key={a.assignmentId}
                    a={a}
                    onConfirm={() => confirm(a)}
                    onCancel={() => openRespond(a)}
                    onOpen={() => open(a.eventId)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {children}

          <p className="py-2 text-center font-display text-xs italic text-muted-foreground/70">Servir com alegria.</p>
        </div>
      </PullToRefresh>

      <Modal open={!!respond} onClose={closeRespond} sheet title={isPending ? "Responder escala" : "Não vai poder?"}>
        {respond ? (
          <>
            <div className="mt-1.5">
              <p className="font-display text-base font-bold text-foreground">{respond.eventTitle}</p>
              <p className="text-[13px] capitalize text-muted-foreground">
                {fmtEventWhen(respond.startsAt)} · {respond.teamName}
              </p>
            </div>

            {isPending ? (
              <>
                <button
                  onClick={confirmFromModal}
                  className="press mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] bg-success text-[15.5px] font-extrabold text-white"
                >
                  <Check className="size-5" strokeWidth={2.8} /> Confirmar presença
                </button>
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[12px] font-semibold text-muted-foreground">ou, se não puder</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : null}

            <p className={cn("text-sm leading-relaxed text-muted-foreground", isPending ? "" : "mt-1.5")}>
              {isPending
                ? "Conta rapidinho o motivo — ajuda o líder a remanejar."
                : "Avisar cedo ajuda o líder a achar alguém. Conta rapidinho o motivo."}
            </p>

            <div className="mt-3 flex flex-wrap gap-2.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r === "Outro" ? "" : r)}
                  className={cn(
                    "press rounded-full border px-3.5 py-2.5 text-sm font-bold",
                    reason === r && r !== "Outro"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-destructive/25 bg-card text-primary",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Escreva o motivo…"
              className="mt-3 w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary"
            />

            <div className="mt-3">
              {!subOpen ? (
                <button
                  onClick={loadSubs}
                  className="press-sm flex w-full items-center gap-2.5 rounded-[14px] border border-border bg-card px-3.5 py-3 text-left"
                >
                  <Users className="size-[18px] text-muted-foreground" />
                  <span className="flex-1 text-[13.5px] text-muted-foreground">
                    Sugerir substituto <span className="text-muted-foreground/60">(opcional)</span>
                  </span>
                  <span className="text-[13px] font-bold text-primary">Escolher ›</span>
                </button>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-[14px] border border-border bg-card p-1.5">
                  {subLoading ? (
                    <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
                  ) : subs && subs.length > 0 ? (
                    subs.map((s) => {
                      const on = selectedSub?.profileId === s.profileId;
                      return (
                        <button
                          key={s.profileId}
                          onClick={() => setSelectedSub(on ? null : s)}
                          className={cn(
                            "press-sm flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left",
                            on && "bg-accent/20",
                          )}
                        >
                          <Avatar name={s.name} src={s.avatarUrl} className="size-9" />
                          <span className="flex-1 text-sm font-semibold">
                            {s.name}
                            {s.recusouAntes ? (
                              <span className="block text-[11px] font-medium text-muted-foreground">
                                já recusou este culto
                              </span>
                            ) : null}
                          </span>
                          {on ? <Check className="size-4 text-primary" strokeWidth={2.6} /> : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">Ninguém disponível pra sugerir agora.</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={submitDecline}
              disabled={reason.trim().length < 3}
              className={cn(
                "press mt-4 h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold transition-opacity",
                reason.trim().length >= 3
                  ? "bg-destructive text-destructive-foreground"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              {selectedSub ? "Pedir troca" : "Não vou poder"}
            </button>
            <button onClick={closeRespond} className="mt-2 h-11 w-full text-[14.5px] font-bold text-muted-foreground">
              {isPending ? "Fechar" : "Deixa, vou confirmar"}
            </button>
          </>
        ) : null}
      </Modal>

      <AchievementCelebration badges={celebrate} onDone={() => setCelebrate([])} />
    </>
  );
}

function EmptyCard() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-border bg-card px-6 py-10 text-center shadow-soft">
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <CalendarDays className="size-7" />
      </span>
      <h3 className="font-display text-lg font-bold">Nenhuma escala por enquanto</h3>
      <p className="max-w-xs text-balance text-sm text-muted-foreground">
        Quando um líder te escalar para servir, aparece aqui — e você confirma num toque.
      </p>
    </div>
  );
}
