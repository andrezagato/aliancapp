import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRoundCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Você está logado como X. Entrar como Y?"
 *
 * O link do convite abre sessão sem senha. Se quem tocou nele já está logado com
 * OUTRA conta — o caso real é o admin abrindo o próprio e-mail pra conferir se o
 * botão funciona —, trocar calado faria ele perder a sessão de admin sem nada na
 * tela explicando. Aqui ele escolhe, e as duas saídas são explícitas.
 */
export default async function ConfirmarTrocaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Sem sessão, não há troca a confirmar — a rota do link resolve sozinha.
  if (!user) redirect(`/auth/entrar/${token}`);

  const admin = createAdminClient();
  const { data: convite } = admin
    ? await admin.from("invites").select("email").eq("token", token).maybeSingle()
    : { data: null };
  if (!convite) redirect("/inicio");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center px-6 py-10">
      <div className="animate-fade-in flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-warning/12 text-warning-ink">
          <UserRoundCog className="size-8" />
        </span>
        <h1 className="text-3xl">Trocar de conta?</h1>
        <p className="text-balance text-muted-foreground">
          Você já está no Sirvo como <span className="font-semibold text-foreground">{user.email}</span>. Este
          convite é de <span className="font-semibold text-foreground">{convite.email}</span> — entrar por
          ele sai da sua conta atual.
        </p>
        <div className="mt-2 w-full space-y-2">
          <Link
            href={`/auth/entrar/${token}?trocar=1`}
            className="press flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[15px] font-bold text-primary-foreground"
          >
            Entrar como {convite.email}
          </Link>
          <Link
            href="/inicio"
            className="press flex h-12 w-full items-center justify-center rounded-[14px] border border-border text-[15px] font-bold"
          >
            Continuar como estou
          </Link>
        </div>
      </div>
    </main>
  );
}
