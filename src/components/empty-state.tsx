import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon,
  title,
  description,
  phase,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  phase?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-xs text-balance text-sm text-muted-foreground">{description}</p>
        {phase ? (
          <span className="mt-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {phase}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
