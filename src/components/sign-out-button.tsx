"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SignOutButton({
  variant = "outline",
  className,
  children,
}: {
  variant?: ButtonProps["variant"];
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sair() {
    setLoading(true);
    if (supabaseConfigured) {
      await createClient().auth.signOut();
    }
    router.push("/entrar");
    router.refresh();
  }

  return (
    <Button variant={variant} className={className} onClick={sair} disabled={loading}>
      <LogOut className="size-4" /> {children ?? (loading ? "Saindo…" : "Sair")}
    </Button>
  );
}
