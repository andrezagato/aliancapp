"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import {
  criarConvite,
  cancelarConvite,
  aprovarJoinRequest,
  recusarJoinRequest,
  aprovarProfilePendente,
} from "@/lib/actions";
import type { InviteTeamInput } from "@/lib/types";

export type TeamOpt = { id: string; name: string; color: string };

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

// -----------------------------------------------------------------------------
// Seletor de equipes (com papel por equipe)
// -----------------------------------------------------------------------------
function TeamPicker({
  teams,
  value,
  onChange,
}: {
  teams: TeamOpt[];
  value: InviteTeamInput[];
  onChange: (v: InviteTeamInput[]) => void;
}) {
  function toggle(teamId: string) {
    const exists = value.find((v) => v.teamId === teamId);
    if (exists) onChange(value.filter((v) => v.teamId !== teamId));
    else onChange([...value, { teamId, role: "volunteer" }]);
  }
  function setRole(teamId: string, role: InviteTeamInput["role"]) {
    onChange(value.map((v) => (v.teamId === teamId ? { ...v, role } : v)));
  }

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {teams.map((t) => {
        const sel = value.find((v) => v.teamId === t.id);
        return (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5">
            <button
              type="button"
              onClick={() => toggle(t.id)}
              className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-md border",
                  sel ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {sel ? <Check className="size-3.5" /> : null}
              </span>
              <TeamDot color={t.color} /> {t.name}
            </button>
            {sel ? (
              <div className="flex overflow-hidden rounded-full border border-border text-xs">
                {(["volunteer", "leader"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(t.id, r)}
                    className={cn(
                      "px-2.5 py-1 font-medium",
                      sel.role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {r === "leader" ? "Líder" : "Voluntário"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Convidar pessoa
// -----------------------------------------------------------------------------
export function ConvidarForm({ teams }: { teams: TeamOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pickedTeams, setPickedTeams] = useState<InviteTeamInput[]>([]);

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setIsAdmin(false);
    setPickedTeams([]);
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await criarConvite({
        fullName,
        email,
        phone,
        systemRole: isAdmin ? "admin" : "member",
        teams: pickedTeams,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Convidar pessoa
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Convidar pessoa</h3>
          <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nome completo</span>
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email (o mesmo do Google)</span>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@gmail.com" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Telefone (opcional)</span>
          <input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Equipes</span>
          <TeamPicker teams={teams} value={pickedTeams} onChange={setPickedTeams} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="size-4 rounded" />
          Tornar administrador da igreja
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={submit} disabled={pending || !email.trim()}>
            {pending ? "Enviando…" : "Convidar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A pessoa entra direto ao logar com o Google usando este email.
        </p>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Aprovar / recusar auto-cadastro (join_request)
// -----------------------------------------------------------------------------
export function JoinRequestActions({ joinId }: { joinId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => run(() => recusarJoinRequest(joinId))} disabled={pending}>
          Recusar
        </Button>
        <Button size="sm" onClick={() => run(() => aprovarJoinRequest(joinId))} disabled={pending}>
          Aprovar
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Aprovar profile pendente (logou sem convite) com equipes
// -----------------------------------------------------------------------------
export function PendingProfileActions({ profileId, teams }: { profileId: string; teams: TeamOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedTeams, setPickedTeams] = useState<InviteTeamInput[]>([]);

  function approve() {
    setError(null);
    start(async () => {
      const r = await aprovarProfilePendente({ profileId, teams: pickedTeams });
      if (!r.ok) setError(r.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Aprovar
      </Button>
    );
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">Em quais equipes?</p>
      <TeamPicker teams={teams} value={pickedTeams} onChange={setPickedTeams} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button size="sm" className="flex-1" onClick={approve} disabled={pending}>
          {pending ? "Aprovando…" : "Confirmar entrada"}
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Cancelar convite pendente
// -----------------------------------------------------------------------------
export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelarConvite(inviteId);
          if (r.ok) router.refresh();
        })
      }
    >
      Cancelar
    </Button>
  );
}
