"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, ChevronRight } from "lucide-react";

/**
 * Card de boas-vindas / "complete seu perfil" — aparece na home enquanto faltar
 * foto, telefone ou data de nascimento. Leva pro /perfil. Dispensável por
 * aparelho (localStorage); some sozinho quando o perfil fica completo.
 */
export function ProfilePrompt({ meId, missing }: { meId: string; missing: string[] }) {
  const [hidden, setHidden] = useState(true); // começa oculto p/ evitar flicker no SSR
  const key = `profile-prompt-dismissed:${meId}`;

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (missing.length === 0 || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  };

  const falta =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} e ${missing[missing.length - 1]}`;

  return (
    <section className="animate-fade-up">
      <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-accent/20 p-4">
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="press-sm absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted-foreground/70 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/25 text-xl">
            <Sparkles className="size-5 text-accent-foreground" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Complete seu perfil 💛</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              Falta {falta}. Preencher deixa sua experiência no app bem melhor.
            </p>
          </div>
        </div>
        <Link
          href="/perfil"
          className="press mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-[14px] bg-primary text-[14.5px] font-extrabold text-primary-foreground"
        >
          Completar agora <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
