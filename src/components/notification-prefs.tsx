"use client";

import { useState } from "react";
import { BellRing, ChevronRight, Smartphone, Mail } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { definirPreferenciaAviso } from "@/lib/actions";
import {
  NOTIFICATION_TOPICS,
  type TopicChannel,
  type TopicId,
  type TopicPrefs,
} from "@/lib/notification-topics";
import { cn } from "@/lib/utils";

/**
 * "O que te avisar" — um interruptor por ASSUNTO, não por tipo de aviso (são 19
 * no banco). Otimista: vira na hora e desfaz se o servidor recusar; ninguém
 * espera spinner pra ligar um interruptor.
 *
 * O sino não tem interruptor de propósito — ele é o registro do que aconteceu.
 * Aqui a pessoa escolhe o que a INTERROMPE.
 */
export function NotificationPrefs({ initial, isGestor }: { initial: TopicPrefs; isGestor: boolean }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<TopicPrefs>(initial);

  const topicos = NOTIFICATION_TOPICS.filter((t) => t.audience === "todos" || isGestor);
  const desligados = topicos.filter((t) => t.channels.some((c) => !prefs[t.id][c])).length;

  function alternar(id: TopicId, channel: TopicChannel) {
    const valor = !prefs[id][channel];
    setPrefs((p) => ({ ...p, [id]: { ...p[id], [channel]: valor } }));
    definirPreferenciaAviso(id, channel, valor).then((r) => {
      if (!r.ok) {
        setPrefs((p) => ({ ...p, [id]: { ...p[id], [channel]: !valor } }));
        showToast(r.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-sm -mx-1 flex w-full items-center gap-2 rounded-[12px] px-1 py-1 text-left"
      >
        <BellRing className="size-4 shrink-0 text-muted-foreground/70" />
        <span className="min-w-0 flex-1 text-sm font-semibold">O que te avisar</span>
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {desligados === 0 ? "tudo ligado" : `${desligados} desligado${desligados > 1 ? "s" : ""}`}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} sheet title="O que te avisar">
        <div className="mt-1 flex items-center justify-end gap-6 pr-1 text-muted-foreground">
          <Smartphone className="size-4" aria-label="No celular" />
          <Mail className="size-4" aria-label="Por e-mail" />
        </div>

        <ul className="mt-1 divide-y divide-border/70">
          {topicos.map((t) => (
            <li key={t.id} className="flex items-start gap-3 py-3.5">
              <span className="mt-0.5 text-xl leading-none" aria-hidden>
                {t.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">{t.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{t.desc}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 pt-0.5">
                {(["push", "email"] as TopicChannel[]).map((c) =>
                  t.channels.includes(c) ? (
                    <Switch
                      key={c}
                      on={prefs[t.id][c]}
                      onToggle={() => alternar(t.id, c)}
                      label={`${t.label} — ${c === "push" ? "no celular" : "por e-mail"}`}
                    />
                  ) : (
                    // canal que não existe pra esse assunto: um traço, não um
                    // interruptor morto
                    <span key={c} className="grid h-6 w-9 place-items-center text-muted-foreground/40" aria-hidden>
                      —
                    </span>
                  ),
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[12.5px] leading-snug text-muted-foreground">
          O sino do app guarda tudo, sempre. Isto aqui escolhe só o que te interrompe.
        </p>
      </Modal>
    </>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-card shadow-soft transition-transform duration-150",
          on ? "translate-x-[1.125rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
