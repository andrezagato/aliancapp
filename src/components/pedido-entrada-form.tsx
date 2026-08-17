"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MailCheck, Check } from "lucide-react";
import { solicitarEntrada, listarEquipesPublicas } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { PrimeirosPassosLink } from "@/components/primeiros-passos-link";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";

type TeamOpt = { id: string; name: string; color: string; icon: string };
type Enviado = "novo" | "ja_pendente" | "ja_aprovado";

/**
 * O formulário de pedido de entrada, num lugar só.
 *
 * Ele vive em DOIS lugares: como painel dentro de /entrar (quando o app descobre
 * que o e-mail digitado não tem acesso — a pessoa não é mandada pra outra página,
 * o pedido acontece ali mesmo, com o e-mail já preenchido) e como página em
 * /cadastro, que continua existindo porque é rota pública antiga e um 404 no meio
 * de um onboarding é o pior desfecho possível. Um formulário só: se o texto muda,
 * muda nos dois.
 */
export function PedidoEntradaForm({
  emailInicial = "",
  onVoltar,
  voltarLabel = "Já tenho acesso",
}: {
  emailInicial?: string;
  /** Presente = painel dentro de /entrar; ausente = página /cadastro. */
  onVoltar?: () => void;
  voltarLabel?: string;
}) {
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    listarEquipesPublicas().then(setTeams);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const r = await solicitarEntrada({
      fullName: String(form.get("full_name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      message: String(form.get("message") ?? ""),
      desiredTeamId: teamId,
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEnviado(r.estado);
  }

  if (enviado) {
    // Dizer "solicitação enviada!" pra quem JÁ foi aprovado é como o app mentiu
    // pra Rayane. Cada estado tem a frase que corresponde ao que de fato existe.
    const jaAprovado = enviado === "ja_aprovado";
    return (
      <div className="animate-fade-in flex flex-col items-center gap-3 text-center">
        <span
          className={cn(
            "inline-flex size-16 items-center justify-center rounded-full",
            jaAprovado ? "bg-success/12 text-success-ink" : "bg-accent/15 text-accent-foreground",
          )}
        >
          {jaAprovado ? <MailCheck className="size-8" /> : <CheckCircle2 className="size-8" />}
        </span>
        <h1 className="text-3xl">{jaAprovado ? "Seu acesso já está liberado" : "Pedido recebido"}</h1>
        <p className="text-balance text-muted-foreground">
          {jaAprovado
            ? "A liderança já aprovou você. Procure na sua caixa de entrada o e-mail do Sirvo com o botão “Entrar no Sirvo” — ele te coloca direto no app."
            : enviado === "ja_pendente"
              ? "Você já tinha pedido, e o pedido continua com a liderança — não criamos outro. Assim que liberarem, chega um e-mail com um botão que já te coloca dentro."
              : "Seu pedido foi pra liderança. Assim que liberarem seu acesso, chega um e-mail com um botão que já te coloca dentro do app. Não precisa pedir de novo."}
        </p>
        <div className="mt-2 w-full space-y-2">
          <p className="text-sm text-muted-foreground">Aproveite a espera e veja o passo a passo:</p>
          <PrimeirosPassosLink />
        </div>
        {onVoltar ? (
          <button onClick={onVoltar} className="mt-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
            Voltar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl">Pedir entrada</h1>
      <p className="mt-2 text-balance text-muted-foreground">
        A liderança confere e libera seu acesso. Você é avisado por e-mail — não precisa voltar aqui.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field name="full_name" label="Nome completo" required />
        <Field name="email" label="E-mail" type="email" defaultValue={emailInicial} required />
        <Field name="phone" label="Telefone / WhatsApp" type="tel" />

        {teams.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Em qual equipe você quer servir?</span>
            <div className="space-y-2">
              {teams.map((t) => {
                const sel = teamId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTeamId(sel ? null : t.id)}
                    className="flex w-full items-center gap-2 rounded-2xl border border-input bg-card p-3 text-left text-sm font-medium"
                  >
                    <span
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                        sel ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {sel ? <Check className="size-3.5" /> : null}
                    </span>
                    <TeamDot color={t.color} /> {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="message" className="text-sm font-medium">
            Observação (opcional)
          </label>
          <textarea
            id="message"
            name="message"
            rows={2}
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Algo que ajude a liderança a te conhecer"
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-ink">{error}</p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Enviando…" : "Enviar pedido"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        {onVoltar ? (
          <button onClick={onVoltar} className="text-sm text-muted-foreground hover:underline">{voltarLabel}</button>
        ) : (
          <a href="/entrar" className="text-sm text-muted-foreground hover:underline">{voltarLabel}</a>
        )}
      </div>
    </div>
  );
}

// `Field` vem inteiro de cadastro/page.tsx (linhas 147–172), com UMA adição:
// `defaultValue`, que é o que permite chegar com o e-mail já preenchido.
function Field({
  name, label, type = "text", required, defaultValue,
}: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label} {required ? <span className="text-primary">*</span> : null}
      </label>
      <input
        id={name} name={name} type={type} required={required} defaultValue={defaultValue}
        className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
