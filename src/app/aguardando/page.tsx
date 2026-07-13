import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getSession, isActive } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AguardandoPage() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  if (isActive(session.profile)) redirect("/inicio");

  const firstName = session.profile.full_name?.split(/\s+/)[0] || "Olá";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
      <Card className="animate-fade-in">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-warning/12 text-warning">
            <Clock className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">{firstName}, quase lá!</h1>
            <p className="mt-2 text-balance text-muted-foreground">
              Recebemos seu acesso. Um líder ou administrador precisa liberar sua entrada na
              igreja — assim que aprovarem, tudo aparece por aqui.
            </p>
          </div>
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Entrou com{" "}
            <span className="font-medium text-foreground">{session.email ?? "sua conta"}</span>.
            Se usou um email diferente do convite, saia e entre com o email convidado.
          </p>
          <SignOutButton className="mt-1 w-full">Sair e trocar de conta</SignOutButton>
        </CardContent>
      </Card>
    </main>
  );
}
