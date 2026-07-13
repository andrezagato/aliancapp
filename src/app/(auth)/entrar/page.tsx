"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function EntrarPage() {
  const [loading, setLoading] = useState<null | "google" | "apple">(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "apple") {
    if (!supabaseConfigured) {
      setError("Configure o Supabase (.env.local) para ativar o login.");
      return;
    }
    setLoading(provider);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="animate-fade-in flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Servir" width={84} height={84} className="rounded-3xl shadow-lift" />
        <h1 className="mt-6 text-4xl font-semibold">Servir</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          As escalas da sua igreja, organizadas com carinho. Cada equipe no seu lugar,
          cada voluntário no seu tempo.
        </p>
      </div>

      <div className="mt-10 space-y-3">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={loading !== null}
          onClick={() => signIn("google")}
        >
          <GoogleMark />
          {loading === "google" ? "Entrando…" : "Entrar com Google"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={loading !== null}
          onClick={() => signIn("apple")}
        >
          <AppleMark />
          {loading === "apple" ? "Entrando…" : "Entrar com Apple"}
        </Button>

        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        É voluntário e ainda não tem acesso?{" "}
        <Link href="/cadastro" className="font-medium text-primary underline-offset-4 hover:underline">
          Solicitar entrada
        </Link>
      </p>

      <div className="mt-10 text-center">
        <Link href="/inicio" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Ver demonstração →
        </Link>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 1.9 14.7 1 12 1 6.9 1 2.8 5.1 2.8 10.1S6.9 21 12 21c5.9 0 9-4.1 9-8.4 0-.6-.1-1-.2-1.4z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
