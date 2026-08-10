"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { definirOptInWhatsApp } from "@/lib/actions";

/**
 * Consentimento de WhatsApp (0052) — obrigatório antes de qualquer template da
 * Meta, e é o tipo de permissão que não dá pra coletar retroativamente: se não
 * começar a pedir agora, o dia em que o canal subir a igreja terá zero opt-in.
 *
 * Fica DESLIGADO por padrão, e desligado é um estado legítimo — não um erro a
 * corrigir com insistência. O texto diz o que vai chegar (escala, lembrete,
 * troca) e o que não vai (divulgação, grupo), porque consentimento sem saber a
 * que se está consentindo não é consentimento.
 *
 * Sem telefone o interruptor não finge funcionar: fica inerte com a razão à
 * vista, em vez de aceitar o toque e falhar no servidor.
 */
export function WhatsAppOptIn({ inicial, temTelefone }: { inicial: boolean; temTelefone: boolean }) {
  const { showToast } = useToast();
  const [on, setOn] = useState(inicial);

  function alternar() {
    const valor = !on;
    setOn(valor); // otimista: ninguém espera spinner pra virar um interruptor
    definirOptInWhatsApp(valor).then((r) => {
      if (!r.ok) {
        setOn(!valor);
        showToast(r.error);
      }
    });
  }

  return (
    <div className="flex items-start gap-2">
      <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Avisos no WhatsApp</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
          {temTelefone
            ? "Escala, lembrete de confirmação e troca no seu número. Nada de divulgação nem grupo."
            : "Adicione seu telefone com DDD abaixo pra poder liberar."}
        </p>
      </div>
      {temTelefone ? (
        <Switch on={on} onToggle={alternar} label="Receber avisos no WhatsApp" />
      ) : (
        // Mesmo padrão do `notification-prefs`: canal indisponível é um traço,
        // não um interruptor morto. Interruptor desabilitado no celular não dá
        // feedback nenhum ao toque — parece app quebrado.
        <span className="grid h-6 w-10 shrink-0 place-items-center text-muted-foreground/40" aria-hidden>
          —
        </span>
      )}
    </div>
  );
}
