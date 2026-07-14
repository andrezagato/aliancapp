"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { ReactiveHeader } from "@/components/app-shell/reactive-header";
import { PullToRefresh } from "@/components/app-shell/pull-to-refresh";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { churchDateISO } from "@/lib/format";
import type { MyAssignment } from "@/lib/data";
import {
  confirmarEscalacao,
  recusarEscalacao,
  fazerCheckin,
  pedirTroca,
  listMembrosParaTroca,
} from "@/lib/actions";
import { TodayCard } from "./today-card";
import { NextScheduleHero } from "./next-schedule-hero";
import { SwipeCard } from "./swipe-card";

const REASONS = ["Viajando", "Trabalho", "Saúde", "Compromisso", "Outro"];
type Sub = { profileId: string; name: string; avatarUrl: string | null };

export function VolunteerHome({
  title,
  subtitle,
  userName,
  unread = 0,
  assignments,
  children,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  unread?: number;
  assignments: MyAssignment[];
  children?: React.ReactNode;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(assignments);
  useEffect(() => setItems(assignments), [assignments]);

  // cancel sheet
  const [cancel, setCancel] = useState<{ id: string; teamId: string } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Sub | null>(null);

  const patch = (id: string, changes: Partial<MyAssignment>) =>
    setItems((prev) => prev.map((a) => (a.assignmentId === id ? { ...a, ...changes } : a)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((a) => a.assignmentId !== id));

  const confirm = (a: MyAssignment) => {
    patch(a.assignmentId, { status: "confirmado" });
    showToast("Presença confirmada — obrigado!");
    startTransition(async () => {
      const r = await confirmarEscalacao(a.assignmentId);
      if (!r.ok) {
        patch(a.assignmentId, { status: "convidado" });
        showToast(r.error);
      }
    });
  };

  const checkin = (a: MyAssignment) => {
    patch(a.assignmentId, { checkedIn: true });
    showToast("Check-in feito. Bom culto!");
    startTransition(async () => {
      const r = await fazerCheckin(a.assignmentId, a.teamId, a.eventId);
      if (!r.ok) {
        patch(a.assignmentId, { checkedIn: false });
        showToast(r.error);
      }
    });
  };

  const openCancel = (a: MyAssignment) => {
    setCancel({ id: a.assignmentId, teamId: a.teamId });
    setReason(null);
    setSelectedSub(null);
    setSubOpen(false);
    setSubs(null);
  };
  const closeCancel = () => setCancel(null);

  const loadSubs = () => {
    if (!cancel) return;
    setSubOpen(true);
    if (subs) return;
    setSubLoading(true);
    startTransition(async () => {
      const list = await listMembrosParaTroca(cancel.teamId);
      setSubs(list);
      setSubLoading(false);
    });
  };

  const submitCancel = () => {
    if (!cancel || !reason) return;
    const id = cancel.id;
    const sub = selectedSub;
    closeCancel();
    if (sub) {
      showToast("Pedido de troca enviado ao líder.");
      startTransition(async () => {
        const r = await pedirTroca(id, reason, sub.profileId);
        if (!r.ok) showToast(r.error);
      });
    } else {
      removeItem(id);
      showToast("Avisamos o líder. Obrigado por avisar.");
      startTransition(async () => {
        const r = await recusarEscalacao(id, reason);
        if (!r.ok) {
          showToast(r.error);
          router.refresh();
        }
      });
    }
  };

  // derive today / hero / list (hero = próxima por data, estável entre estados)
  const todaySP = churchDateISO(new Date().toISOString());
  const sorted = [...items].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const today = sorted.find((a) => churchDateISO(a.startsAt) === todaySP) || null;
  const upcoming = sorted.filter((a) => a !== today);
  const hero = upcoming[0] || null;
  const list = upcoming.slice(1);
  const nothing = !today && !hero && list.length === 0;

  const open = (id: string) => router.push(`/escalas/${id}`);

  return (
    <>
      <ReactiveHeader title={title} subtitle={subtitle} userName={userName} unread={unread} />
      <div aria-hidden style={{ height: "calc(env(safe-area-inset-top) + 5rem)" }} />

      <PullToRefresh>
        <div className="space-y-4">
          {nothing ? <EmptyCard /> : null}
          {today ? (
            <TodayCard a={today} onConfirm={() => confirm(today)} onCancel={() => openCancel(today)} onCheckin={() => checkin(today)} />
          ) : null}
          {hero ? (
            <NextScheduleHero a={hero} onConfirm={() => confirm(hero)} onCancel={() => openCancel(hero)} onOpen={() => open(hero.eventId)} />
          ) : null}

          {list.length > 0 ? (
            <section>
              <div className="flex items-baseline justify-between px-1 pb-1.5">
                <h3 className="font-display text-lg font-bold text-foreground">Suas escalas</h3>
                <span className="text-xs font-semibold text-muted-foreground">Arraste p/ responder</span>
              </div>
              <div className="space-y-2.5">
                {list.map((a) => (
                  <SwipeCard
                    key={a.assignmentId}
                    a={a}
                    onConfirm={() => confirm(a)}
                    onCancel={() => openCancel(a)}
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

      <Modal open={!!cancel} onClose={closeCancel} sheet title="Não vai poder?">
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Avisar cedo ajuda o líder a achar alguém. Conta rapidinho o motivo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "press rounded-full border px-3.5 py-2.5 text-sm font-bold",
                reason === r ? "border-primary bg-primary text-primary-foreground" : "border-destructive/25 bg-card text-primary",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-4">
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
                      <span className="flex-1 text-sm font-semibold">{s.name}</span>
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
          onClick={submitCancel}
          disabled={!reason}
          className={cn(
            "press mt-4 h-[52px] w-full rounded-[15px] text-[15.5px] font-extrabold transition-opacity",
            reason ? "bg-destructive text-destructive-foreground" : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {selectedSub ? "Pedir troca" : "Avisar que não posso"}
        </button>
        <button onClick={closeCancel} className="mt-2 h-11 w-full text-[14.5px] font-bold text-muted-foreground">
          Deixa, vou confirmar
        </button>
      </Modal>
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
