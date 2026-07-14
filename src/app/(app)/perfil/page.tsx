import Link from "next/link";
import { Mail, Phone, Cake, Users, History } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { TeamDot } from "@/components/coverage-badge";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { fmtBirthday } from "@/lib/format";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) return null;
  const p = session.profile;

  const roleLabel =
    session.role === "admin" ? "Administrador" : session.role === "leader" ? "Líder" : "Voluntário";

  return (
    <>
      <TopBar title="Perfil" userName={p.full_name || "?"} />
      <div className="animate-fade-in space-y-5 py-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Avatar name={p.full_name || "?"} src={p.avatar_url} className="size-20 text-xl" />
            <div>
              <h2 className="text-xl font-semibold">{p.full_name || "Sem nome"}</h2>
              <p className="text-sm text-muted-foreground">{roleLabel}</p>
            </div>
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              {p.email ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-4" /> {p.email}
                </span>
              ) : null}
              {p.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-4" /> {p.phone}
                </span>
              ) : null}
              {p.birth_date ? (
                <span className="inline-flex items-center gap-1.5">
                  <Cake className="size-4" /> {fmtBirthday(p.birth_date)}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Minhas equipes</h3>
          {p.teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
                Você ainda não está em nenhuma equipe.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {p.teams.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 p-4">
                    <TeamDot color={t.color} className="size-3" />
                    <span className="flex-1 font-medium">{t.name}</span>
                    {t.role === "leader" ? <Badge variant="primary">Líder</Badge> : <Badge>Voluntário</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <Link href="/historico" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <History className="size-4" /> Histórico de escalas
        </Link>

        {session.role !== "volunteer" ? (
          <Link href="/equipes" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            <Users className="size-4" /> Gerenciar equipes e posições
          </Link>
        ) : null}

        <SignOutButton className="w-full" />
      </div>
    </>
  );
}
