import { PlayCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Leva pra demo interativa "Primeiros passos" (`public/primeiros-passos.html`).
 * É um arquivo estático fora do roteamento do Next — por isso `<a>` e não `<Link>`.
 * Aparece nos momentos em que a pessoa pediu acesso e está esperando: tela de
 * "confira seu email", solicitação enviada e fila de aprovação.
 */
export function PrimeirosPassosLink({
  className,
  label = "Ver os primeiros passos",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      href="/primeiros-passos.html"
      target="_blank"
      rel="noopener"
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full", className)}
    >
      <PlayCircle />
      {label}
    </a>
  );
}
