import type { AssignmentStatus } from "@/lib/supabase/database.types";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "primary";

export const STATUS_META: Record<
  AssignmentStatus,
  { label: string; variant: BadgeVariant; icon: string }
> = {
  convidado: { label: "Aguardando confirmação", variant: "warning", icon: "clock" },
  confirmado: { label: "Confirmado", variant: "success", icon: "check" },
  recusado: { label: "Recusou", variant: "danger", icon: "x" },
  vaga_aberta: { label: "Vaga em aberto", variant: "primary", icon: "circle-dashed" },
  presente: { label: "Presente", variant: "success", icon: "badge-check" },
};
