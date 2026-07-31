import { cn } from "@/lib/utils";
import type { CoverageTone } from "@/lib/coverage";

const TONE: Record<CoverageTone, { pill: string; dot: string }> = {
  full: { pill: "bg-success/12 text-success-ink", dot: "bg-success" },
  partial: { pill: "bg-warning/15 text-warning-ink", dot: "bg-warning" },
  empty: { pill: "bg-destructive/12 text-destructive-ink", dot: "bg-destructive" },
};

export function CoverageBadge({
  tone,
  assigned,
  needed,
  label,
  className,
}: {
  tone: CoverageTone;
  assigned?: number;
  needed?: number;
  label?: string;
  className?: string;
}) {
  const t = TONE[tone];
  const text = label ?? (needed != null ? `${assigned ?? 0}/${needed}` : "");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        t.pill,
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", t.dot)} />
      {text}
    </span>
  );
}

/** Pontinho colorido da equipe. */
export function TeamDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
