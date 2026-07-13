"use client";

import { useRouter } from "next/navigation";
import { LogOut, Music, Sliders } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { demoUser } from "@/lib/demo";

export default function PerfilPage() {
  const router = useRouter();

  async function sair() {
    if (supabaseConfigured) {
      await createClient().auth.signOut();
    }
    router.push("/entrar");
  }

  return (
    <>
      <TopBar title="Perfil" userName={demoUser.fullName} />
      <div className="animate-fade-in space-y-5 py-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Avatar name={demoUser.fullName} className="size-20 text-xl" />
            <div>
              <h2 className="text-xl font-semibold">{demoUser.fullName}</h2>
              <p className="text-sm text-muted-foreground">{demoUser.roleLabel}</p>
            </div>
          </CardContent>
        </Card>

        <section>
          <h3 className="mb-2 px-1 text-base font-semibold">Minhas equipes</h3>
          <Card>
            <ul className="divide-y divide-border">
              <li className="flex items-center gap-3 p-4">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Music className="size-5" />
                </span>
                <span className="flex-1 font-medium">Louvor</span>
                <Badge variant="primary">Líder</Badge>
              </li>
              <li className="flex items-center gap-3 p-4">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/12 text-accent">
                  <Sliders className="size-5" />
                </span>
                <span className="flex-1 font-medium">Som</span>
                <Badge>Voluntário</Badge>
              </li>
            </ul>
          </Card>
        </section>

        <Button variant="outline" className="w-full" onClick={sair}>
          <LogOut className="size-4" /> Sair
        </Button>
      </div>
    </>
  );
}
