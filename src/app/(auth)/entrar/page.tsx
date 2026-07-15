"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SirvoMark } from "@/components/brand/sirvo-mark";

const isDev = process.env.NODE_ENV === "development";

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none transition focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring";

export default function EntrarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "google" | "magic" | "dev">(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [devPassword, setDevPassword] = useState("");

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

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!ensureConfigured()) return;
    if (!email.includes("@")) {
      setError("Informe um email válido.");
      return;
    }
    setLoading("magic");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(null);
    if (error) setError(error.message);
    else setMagicSent(true);
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

  if (magicSent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center px-6 py-10">
        <div className="animate-fade-in flex flex-col items-center gap-4 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-success/12 text-success">
            <MailCheck className="size-8" />
          </span>
          <h1 className="text-3xl">Confira seu email</h1>
          <p className="text-balance text-muted-foreground">
            Enviamos um link de acesso para <span className="font-semibold text-foreground">{email}</span>.
            Abra no seu celular ou computador para entrar — o link vale por 1 hora.
          </p>
          <button
            onClick={() => {
              setMagicSent(false);
              setError(null);
            }}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Usar outro email
          </button>
        </div>
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

        <form onSubmit={sendMagicLink} className="space-y-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" disabled={loading !== null}>
            {loading === "magic" ? "Enviando…" : "Receber link de acesso"}
          </Button>
        </form>

        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        É voluntário e ainda não tem acesso?{" "}
        <Link href="/cadastro" className="font-semibold text-primary underline-offset-4 hover:underline">
          Solicitar entrada
        </Link>
      </p>

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
