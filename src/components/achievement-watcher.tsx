"use client";

import { useEffect, useRef, useState } from "react";
import { AchievementCelebration } from "@/components/achievement-celebration";
import { useToast } from "@/components/ui/toast";
import { sincronizarConquistas } from "@/lib/actions";
import { getSeen, markSeen } from "@/lib/achievements-seen";
import { splitCelebrations, type UnlockedBadge } from "@/lib/achievements";

/**
 * Ao ENTRAR no app, comemora as conquistas que a pessoa ainda não viu celebradas
 * neste aparelho — não só quando abre a Minha Jornada. Roda uma vez por carga do
 * app (fica no layout). Limita a 6 de uma vez pra não virar enxurrada no 1º login.
 *
 * Conquista marcada como `celebration: "toast"` passa discreta: tela cheia é pra
 * marco, não pra "preenchi o telefone".
 */
export function AchievementWatcher() {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<UnlockedBadge[]>([]);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    sincronizarConquistas()
      .then((unlocked) => {
        if (!unlocked || unlocked.length === 0) return;
        const seen = getSeen();
        const fresh = unlocked.filter((b) => !seen.has(b.code));
        markSeen(unlocked.map((b) => b.code)); // tudo que já está desbloqueado vira "visto"
        if (fresh.length === 0) return;
        const { full, toasts } = splitCelebrations(fresh);
        if (full.length > 0) setQueue(full.slice(0, 6));
        for (const b of toasts) showToast(`${b.emoji} ${b.title}`);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AchievementCelebration badges={queue} onDone={() => setQueue([])} />;
}
