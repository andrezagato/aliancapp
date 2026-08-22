"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, Hourglass } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { verificarEmailParaLink, reenviarLinkDeAcesso } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { SirvoMark } from "@/components/brand/sirvo-mark";
import { PrimeirosPassosLink } from "@/components/primeiros-passos-link";
import { PedidoEntradaForm } from "@/components/pedido-entrada-form";

const isDev = process.env.NODE_ENV === "development";

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none transition focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring";

/**
 * UMA TELA, UM BOTÃO.
 *
 * Antes daqui havia duas chamadas concorrentes — "Receber link de acesso" e, no
 * rodapé, "É voluntário e ainda não tem acesso? Solicitar entrada" — e a pessoa
 * tinha que adivinhar em qual dos dois grupos ela estava. Ela não sabe. O app
 * sabe: `verificarEmailParaLink` responde "ok", "aguardando" ou "nao_encontrado".
 * Só que ele só era consultado DEPOIS que ela já tinha escolhido.
 *
 * Agora quem escolhe é o app: "Continuar" pergunta primeiro e abre UM caminho.
 */
type Etapa = "inicio" | "link_enviado" | "ja_liberado" | "em_analise" | "pedir_entrada";

/**
 * Recados de quem chegou aqui empurrado — pelo link de entrada
 * (`/auth/entrar/[token]`) ou pelo callback do OAuth. Nenhum é beco sem saída:
 * todos terminam no campo de e-mail logo abaixo, que resolve.
 */
const RECADOS: Record<string, string> = {
  expirado: "Esse link de acesso já venceu. Informe seu e-mail abaixo que a gente manda um novo.",
  invalido: "Não reconhecemos esse link. Informe seu e-mail abaixo pra continuar.",
  falhou: "Não consegui abrir sua sessão por esse link. Toque nele de novo — se não der, informe seu e-mail abaixo.",
  indisponivel: "Não consegui abrir sua sessão por esse link. Informe seu e-mail abaixo pra continuar.",
  auth: "Não consegui concluir o login. Tente de novo aqui embaixo.",
  ja_tem_conta: "Você já tem conta no Sirvo. Informe seu e-mail abaixo que a gente manda o link de acesso.",
};

export default function EntrarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "google" | "email" | "dev" | "reenvio">(null);
  const [reenviado, setReenviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [recado, setRecado] = useState<string | null>(null);
  const [devPassword, setDevPassword] = useState("");

  // Lido no cliente de propósito: `useSearchParams` obrigaria esta página a
  // nascer dentro de um <Suspense> pra não quebrar o build estático, e não vale
  // esse preço por um recado.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const motivo = p.get("link") ?? p.get("erro");
    if (motivo) setRecado(RECADOS[motivo] ?? RECADOS.invalido);
  }, []);

  function ensureConfigured() {
    if (!supabaseConfigured) {
      setError("Configure o Supabase (.env.local) para ativar o login.");
      return false;
    }
    return true;
  }

  async function signInWithGoogle() {
    if (!ensureConfigured()) return;
    setLoading("google");
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    if (!ensureConfigured()) return;
    const alvo = email.trim();
    if (!alvo.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    setLoading("email");
    setError(null);
    setRecado(null);

    // Pergunta ANTES de agir — é isto que dispensa a pessoa de escolher. E é a
    // mesma checagem que impede `signInWithOtp` de criar conta órfã (pendente e
    // sem igreja) pra qualquer e-mail digitado.
    const { status } = await verificarEmailParaLink(alvo);

    if (status === "nao_encontrado") {
      setLoading(null);
      setEtapa("pedir_entrada");   // o pedido acontece AQUI, sem trocar de página
      return;
    }
    if (status === "aguardando") {
      setLoading(null);
      setEtapa("em_analise");
      return;
    }
    // Já aprovada, mas ainda não entrou: ela JÁ TEM um link de acesso na caixa,
    // e o dela vale 7 dias contra a 1 hora do link de login. Mandar outro aqui
    // deixaria dois e-mails concorrentes na mão dela — o certo é apontar pro que
    // já existe, e oferecer reenviar só pra quem apagou.
    if (status === "convite_pendente") {
      setLoading(null);
      setEtapa("ja_liberado");
      return;
    }

    const { error } = await createClient().auth.signInWithOtp({
      email: alvo,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(null);
    if (error) setError(error.message);
    else setEtapa("link_enviado");
  }

  async function devSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!ensureConfigured()) return;
    setLoading("dev");
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password: devPassword,
    });
    if (error) {
      setError(error.message);
      setLoading(null);
      return;
    }
    router.push("/inicio");
    router.refresh();
  }

  function voltarAoInicio() {
    setEtapa("inicio");
    setError(null);
    setReenviado(false);
  }

  /**
   * Reenvia o e-mail de acesso liberado.
   *
   * A action responde `ok` quando NÃO ACHA convite, pra não virar um oráculo de
   * "este e-mail existe na igreja?" — e essa parte continua igual: a tela
   * confirma sem afirmar que a pessoa existe.
   *
   * O QUE MUDOU: quando ela acha o convite e o ENVIO FALHA, ela devolve `fail`,
   * e agora a tela lê isso. Antes o retorno era descartado e o "Pronto,
   * enviamos de novo" aparecia mesmo com o Resend fora do ar — e esta é a única
   * porta de quem não usa Google, então a pessoa esperava pra sempre um e-mail
   * que nunca tinha saído.
   */
  async function reenviar() {
    setLoading("reenvio");
    const r = await reenviarLinkDeAcesso(email.trim());
    setLoading(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setReenviado(true);
  }

  if (etapa === "link_enviado") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center px-6 py-10">
        <div className="animate-fade-in flex flex-col items-center gap-4 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/12 text-success-ink">
            <MailCheck className="size-8" />
          </span>
          <h1 className="text-3xl">Confira seu email</h1>
          <p className="text-balance text-muted-foreground">
            Enviamos um link de acesso para <span className="font-semibold text-foreground">{email}</span>.
            Abra no seu celular ou computador para entrar — o link vale por 1 hora.
          </p>
          <div className="mt-2 w-full space-y-2">
            <p className="text-sm text-muted-foreground">
              Enquanto o link não chega, veja como o Sirvo funciona:
            </p>
            <PrimeirosPassosLink />
          </div>
          <button
            onClick={voltarAoInicio}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Usar outro email
          </button>
        </div>
      </main>
    );
  }

  if (etapa === "ja_liberado") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center px-6 py-10">
        <div className="animate-fade-in flex flex-col items-center gap-4 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/12 text-success-ink">
            <MailCheck className="size-8" />
          </span>
          <h1 className="text-3xl">Seu acesso já foi liberado</h1>
          <p className="text-balance text-muted-foreground">
            A liderança aprovou seu pedido. Agora só falta abrir o e-mail que enviamos para{" "}
            <span className="font-semibold text-foreground">{email.trim()}</span> e tocar em{" "}
            <span className="font-semibold text-foreground">Entrar no Sirvo</span> — o botão de lá já te
            coloca dentro do app, sem digitar nada.
          </p>
          {reenviado ? (
            <p className="w-full rounded-2xl bg-success/10 px-4 py-3 text-sm font-medium text-success-ink">
              Pronto, enviamos de novo. Pode levar um minutinho pra chegar.
            </p>
          ) : (
            /* Só pra quem apagou o e-mail sem querer. Não é o caminho principal
               de propósito: o link que ela já tem vale 7 dias, e um segundo
               e-mail na caixa só cria dúvida sobre qual usar. */
            <button
              onClick={reenviar}
              disabled={loading === "reenvio"}
              className="press-sm h-11 w-full rounded-[14px] border border-border text-[15px] font-bold text-foreground disabled:opacity-60"
            >
              {loading === "reenvio" ? "Reenviando…" : "Não achei o e-mail — reenviar"}
            </button>
          )}
          {/* Sem isto o `setError` do `reenviar()` não tem onde escrever, e o
              conserto da action morre uma camada acima. */}
          {error ? (
            <p className="w-full rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive-ink">{error}</p>
          ) : null}
          <button
            onClick={voltarAoInicio}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Usar outro e-mail
          </button>
        </div>
      </main>
    );
  }

  if (etapa === "em_analise") {
    // Âmbar, não a caixa vermelha de erro: estar na fila não é um erro dela.
    return (
      <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center px-6 py-10">
        <div className="animate-fade-in flex flex-col items-center gap-4 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-warning/12 text-warning-ink">
            <Hourglass className="size-8" />
          </span>
          <h1 className="text-3xl">Seu pedido está com a liderança</h1>
          <p className="text-balance text-muted-foreground">
            Assim que aprovarem, você recebe um e-mail com um botão que já te coloca dentro do app. Você não
            precisa pedir de novo.
          </p>
          <button
            onClick={voltarAoInicio}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  if (etapa === "pedir_entrada") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
        <div className="animate-fade-in mb-6 rounded-xl bg-accent/10 px-4 py-3 text-center text-sm">
          <p className="font-semibold">Ainda não temos um convite pra esse e-mail</p>
          <p className="mt-1 text-muted-foreground">
            Se você serve na igreja, peça entrada abaixo e a liderança libera seu acesso.
          </p>
        </div>
        <PedidoEntradaForm emailInicial={email.trim()} onVoltar={voltarAoInicio} voltarLabel="Voltar" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center px-6 py-12">
      <div className="animate-fade-in flex flex-col items-center text-center">
        <span className="inline-flex size-[76px] items-center justify-center rounded-[22px] bg-primary shadow-lift">
          <SirvoMark className="h-12 w-auto text-primary-foreground" />
        </span>
        <h1 className="mt-6 font-display text-5xl font-extrabold text-primary">Sirvo</h1>
        <p className="mt-2 text-balance font-display text-lg italic text-muted-foreground">
          as escalas da sua igreja, com alma
        </p>
      </div>

      <div className="mt-10 space-y-3">
        <Button variant="outline" size="lg" className="w-full" disabled={loading !== null} onClick={signInWithGoogle}>
          <GoogleMark />
          {loading === "google" ? "Entrando…" : "Entrar com Google"}
        </Button>

        <div className="flex items-center gap-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou pelo email <span className="h-px flex-1 bg-border" />
        </div>

        {recado ? (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-center text-sm">{recado}</p>
        ) : null}

        <form onSubmit={continuar} className="space-y-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {/* UM botão. O app é que sabe se isso vira link de acesso ou pedido de
              entrada — perguntar isso pra ela era pedir que adivinhasse. */}
          <Button type="submit" size="lg" className="w-full" disabled={loading !== null}>
            {loading === "email" ? "Continuando…" : "Continuar"}
          </Button>
        </form>

        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive-ink">{error}</p>
        ) : null}
      </div>

      {isDev ? (
        <details className="mt-10 rounded-2xl border border-dashed border-border p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">Login de teste (dev)</summary>
          <form onSubmit={devSignIn} className="mt-3 space-y-2">
            <input type="email" placeholder="joana@teste.local" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="senha (teste123)" className={inputClass} value={devPassword} onChange={(e) => setDevPassword(e.target.value)} />
            <Button type="submit" variant="ghost" className="w-full" disabled={loading !== null}>
              {loading === "dev" ? "Entrando…" : "Entrar (dev)"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            joana@ (líder Louvor), ana@ (líder Som), tiago@ (líder Kids), pedro@/rafael@/bia@/lucas@/clara@ (voluntários). Senha: teste123.
          </p>
        </details>
      ) : null}
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 1.9 14.7 1 12 1 6.9 1 2.8 5.1 2.8 10.1S6.9 21 12 21c5.9 0 9-4.1 9-8.4 0-.6-.1-1-.2-1.4z"
      />
    </svg>
  );
}
