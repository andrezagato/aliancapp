"use client";

import { ReactiveHeader } from "./reactive-header";
import { PullToRefresh } from "./pull-to-refresh";

/**
 * Casca da home para líder/admin: mesmo cabeçalho reativo + pull-to-refresh do
 * voluntário, mas o conteúdo (tiles, herói, listas) continua server-rendered e
 * entra como children. O voluntário tem seu próprio orquestrador (VolunteerHome)
 * por causa do estado otimista/swipe.
 */
export function HomeShell({
  title,
  subtitle,
  userName,
  unread = 0,
  children,
}: {
  title: string;
  subtitle?: string;
  userName: string;
  unread?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <ReactiveHeader title={title} subtitle={subtitle} userName={userName} unread={unread} />
      <div aria-hidden style={{ height: "calc(env(safe-area-inset-top) + 5rem)" }} />
      <PullToRefresh>
        <div className="space-y-4">
          {children}
          <p className="py-2 text-center font-display text-xs italic text-muted-foreground/70">Servir com alegria.</p>
        </div>
      </PullToRefresh>
    </>
  );
}
