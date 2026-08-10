"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, ChevronRight, PhoneOff } from "lucide-react";

/**
 * Card de boas-vindas / "complete seu perfil" — aparece na home enquanto faltar
 * foto, telefone ou data de nascimento. Leva pro /perfil. Dispensável por
 * aparelho (localStorage); some sozinho quando o perfil fica completo.
 *
 * `semCanal` é um segundo estado, com prioridade sobre o primeiro (0052): a
 * pessoa não tem push instalado NEM telefone, então nenhum aviso de escala
 * chega nela. Isso não é perfil incompleto, é ficar de fora — e o card diz a
 * consequência em vez de listar um campo. Em 10/ago eram 18 das 44 pessoas.
 *
 * Duas decisões que importam aqui:
 *  · CHAVE DE DISPENSA SEPARADA. Quem dispensou "complete seu perfil" um dia
 *    tem `profile-prompt-dismissed` gravado pra sempre — e nunca veria o aviso
 *    que de fato importa. Reusar a chave seria esconder o grave atrás do leve.
 *  · TOM DE RISCO, não de recompensa. O dourado do sistema é celebração; ficar
 *    inalcançável é cobertura furada, que no Sirvo fala em âmbar.
 */
export function ProfilePrompt({
  meId,
  missing,
  semCanal = false,
}: {
  meId: string;
  missing: string[];
  semCanal?: boolean;
}) {
  const [hidden, setHidden] = useState(true); // começa oculto p/ evitar flicker no SSR
  const key = semCanal ? `sem-canal-dismissed:${meId}` : `profile-prompt-dismissed:${meId}`;

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if ((missing.length === 0 && !semCanal) || hidden) return null;

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
      <div
        className={
          semCanal
            ? "relative overflow-hidden rounded-2xl border border-warning/40 bg-warning/10 p-4"
            : "relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-accent/20 p-4"
        }
      >
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="press-sm absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted-foreground/70 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span
            className={
              semCanal
                ? "grid size-10 shrink-0 place-items-center rounded-full bg-warning/20"
                : "grid size-10 shrink-0 place-items-center rounded-full bg-accent/25 text-xl"
            }
          >
            {semCanal ? (
              <PhoneOff className="size-5 text-warning-ink" />
            ) : (
              <Sparkles className="size-5 text-accent-foreground" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">
              {semCanal ? "Ninguém consegue te avisar" : "Complete seu perfil 💛"}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              {semCanal
                ? "Você não recebe aviso no celular e não tem telefone cadastrado. Se for escalado, vai descobrir no domingo."
                : `Falta ${falta}. Preencher deixa sua experiência no app bem melhor.`}
            </p>
          </div>
        </div>
        <Link
          href="/perfil"
          className="press mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-[14px] bg-primary text-[14.5px] font-extrabold text-primary-foreground"
        >
          {semCanal ? "Cadastrar meu telefone" : "Completar agora"} <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
