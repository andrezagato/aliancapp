import { ListChecks, Music, Megaphone, Timer, Users, FolderOpen } from "lucide-react";
import { TopBar } from "@/components/app-shell/top-bar";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth";

const FEATURES: { icon: React.ElementType; title: string; desc: string }[] = [
  { icon: ListChecks, title: "Ordem do culto", desc: "Monte o roteiro momento a momento — e use modelos pra repetir rapidinho." },
  { icon: Music, title: "Repertório", desc: "As músicas de cada culto, com tom e links, na mão de quem toca e canta." },
  { icon: Megaphone, title: "Avisos", desc: "O que precisa ser comunicado, na hora certa, sem esquecer nada." },
  { icon: Timer, title: "Tempos", desc: "Quanto dura cada momento — pra o culto fluir no tempo certo." },
  { icon: Users, title: "Quem faz o quê", desc: "Cada momento com seu responsável, ligado à escala das equipes." },
  { icon: FolderOpen, title: "Arquivos", desc: "Um lugar pra artes, vídeos e materiais do culto — todo mundo acha fácil." },
];

export default async function CronogramaPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <>
      <TopBar title="Cronograma" subtitle="Em breve" userName={session.profile.full_name || "?"} />
      <div className="animate-fade-in space-y-4 py-3">
        {/* Herói */}
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-primary to-[hsl(349_74%_19%)] p-6 text-primary-foreground shadow-lift">
          <div
            className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-70"
            style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.45), transparent 70%)" }}
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Em breve</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-white">Planeje o culto inteiro aqui</h1>
            <p className="mt-1.5 max-w-sm text-sm text-primary-foreground/85">
              A ordem do culto, as músicas, os avisos, os tempos e os arquivos — tudo num lugar só, ligado à escala das
              equipes. Estamos construindo. 🙌
            </p>
          </div>
        </div>

        {/* Prévia do que vem */}
        <div className="space-y-2.5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="flex items-start gap-3 p-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </Card>
          ))}
        </div>

        <p className="px-1 text-center text-xs text-muted-foreground/80">
          Quer dar palpite no que vem primeiro? Fala com a liderança. 💬
        </p>
      </div>
    </>
  );
}
