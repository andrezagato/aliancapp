"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { aceitarSubstituicao, recusarSubstituicao } from "@/lib/actions";
import { fmtEventWhen } from "@/lib/format";
import type { SwapInboxItem } from "@/lib/data";

export function SwapInbox({ items }: { items: SwapInboxItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Pedidos de troca pra você</h3>
      <div className="space-y-3">
        {items.map((s) => (
          <SwapCard key={s.swapId} item={s} />
        ))}
      </div>
    </section>
  );
}

function SwapCard({ item }: { item: SwapInboxItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean }>) {
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
    });
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ArrowLeftRight className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{item.requesterName}</span> pediu pra você substituir em{" "}
              <span className="font-medium">{item.positionName}</span> ({item.teamName}).
            </p>
            <p className="text-sm text-muted-foreground">
              {item.eventTitle} · {fmtEventWhen(item.startsAt)}
            </p>
            {item.reason ? <p className="mt-0.5 text-sm text-muted-foreground">“{item.reason}”</p> : null}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button variant="outline" size="sm" onClick={() => run(() => recusarSubstituicao(item.swapId))} disabled={pending}>
            Não posso
          </Button>
          <Button size="sm" onClick={() => run(() => aceitarSubstituicao(item.swapId))} disabled={pending}>
            {pending ? "…" : "Topo substituir"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
