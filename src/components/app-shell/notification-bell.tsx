"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

/**
 * Sino com contagem de não-lidas ao vivo (Supabase Realtime). Auto-suficiente:
 * busca a própria contagem (RLS entrega só as do usuário) e re-busca quando
 * chega/muda uma notificação da própria pessoa.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refresh(uid: string) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .eq("recipient_id", uid);
      if (active) setUnread(count ?? 0);
    }

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !active) return;
      await refresh(uid);
      channel = supabase
        .channel("notif-bell")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${uid}` },
          () => refresh(uid),
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Link
      href="/notificacoes"
      aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
      className="press relative grid size-[42px] shrink-0 place-items-center rounded-full bg-primary/[0.06] text-foreground"
    >
      <Bell className="size-[21px]" />
      {unread > 0 ? (
        <span className="absolute right-1 top-1 grid min-w-[17px] place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
