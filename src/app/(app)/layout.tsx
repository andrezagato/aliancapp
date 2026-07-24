import { redirect } from "next/navigation";
import { getSession, isActive } from "@/lib/auth";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { ToastProvider } from "@/components/ui/toast";
import { AchievementWatcher } from "@/components/achievement-watcher";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { listarCanais } from "@/lib/chat";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/entrar");
  if (!isActive(session.profile)) redirect("/aguardando");

  // Canais do chat pro balão flutuante (aparece em todas as telas do app).
  const canais = await listarCanais(session);

  return (
    <ToastProvider>
      <div className="min-h-dvh">
        <main className="mx-auto max-w-[520px] px-4 pb-28 pt-2 lg:max-w-[720px]">{children}</main>
        <BottomNav />
        <ChatBubble canais={canais} meId={session.userId} role={session.role} />
        <AchievementWatcher />
      </div>
    </ToastProvider>
  );
}
