"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Check } from "lucide-react";
import { solicitarEntrada, listarEquipesPublicas } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamDot } from "@/components/coverage-badge";
import { PrimeirosPassosLink } from "@/components/primeiros-passos-link";
import { cn } from "@/lib/utils";

type TeamOpt = { id: string; name: string; color: string; icon: string };

export default function CadastroPage() {
  const [sent, setSent] = useState(false);
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
    if (!r.ok) {
      setError(r.error);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6">
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="size-14 text-success" />
            <h1 className="text-2xl font-semibold">Solicitação enviada!</h1>
            <p className="text-balance text-muted-foreground">
              Um líder vai revisar e liberar seu acesso. Você será avisado assim que aprovado.
            </p>
            <div className="mt-2 w-full space-y-2">
              <p className="text-sm text-muted-foreground">
                Aproveite a espera e veja o passo a passo:
              </p>
              <PrimeirosPassosLink />
            </div>
            <Link href="/entrar" className="mt-2 text-sm font-medium text-primary hover:underline">
              Voltar
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-semibold">Solicitar entrada</h1>
        <p className="mt-2 text-muted-foreground">
          Preencha seus dados. Um líder aprova e você entra na igreja.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field name="full_name" label="Nome completo" required />
          <Field name="email" label="Email" type="email" />
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
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Enviando…" : "Enviar solicitação"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/entrar" className="text-sm text-muted-foreground hover:underline">
            Já tenho acesso
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label} {required ? <span className="text-primary">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
