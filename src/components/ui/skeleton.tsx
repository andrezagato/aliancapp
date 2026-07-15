import { cn } from "@/lib/utils";

/** Bloco cinza que pulsa — placeholder de carregamento. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} aria-hidden />;
}

/**
 * Esqueleto genérico das telas logadas — mostrado pelo loading.tsx enquanto o
 * server renderiza, dando sensação de instantâneo (o layout/bottom-nav já ficam).
 */
export function PageSkeleton() {
  return (
    <div className="space-y-4 pt-safe" aria-busy="true">
      <div className="space-y-2 pb-1 pt-2">
        <Skeleton className="h-7 w-44 rounded-lg" />
        <Skeleton className="h-4 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-44 w-full rounded-[24px]" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
