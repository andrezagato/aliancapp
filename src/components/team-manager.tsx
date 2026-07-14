"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Pencil, Archive, UserPlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { cn } from "@/lib/utils";
import {
  criarEquipe,
  criarPosicao,
  renomearPosicao,
  arquivarPosicao,
  adicionarMembro,
  definirPapelMembro,
  removerMembro,
} from "@/lib/actions";
import type { ManageableTeam } from "@/lib/data";

type Profile = { id: string; name: string; avatarUrl: string | null };

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SUGESTOES = [
  "Líder", "Vocal", "Guitarra", "Baixo", "Bateria", "Teclado",
  "Mesa de som", "Projeção", "Câmera", "Recepção", "Professor", "Auxiliar",
];

export function TeamManager({
  teams,
  allProfiles,
  canCreateTeam,
}: {
  teams: ManageableTeam[];
  allProfiles: Profile[];
  canCreateTeam: boolean;
}) {
  return (
    <div className="space-y-4">
      {canCreateTeam ? <NovaEquipe /> : null}
      {teams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
            {canCreateTeam
              ? "Nenhuma equipe ainda. Crie a primeira acima."
              : "Você ainda não lidera nenhuma equipe."}
          </CardContent>
        </Card>
      ) : (
        teams.map((team) => <TeamCard key={team.id} team={team} allProfiles={allProfiles} />)
      )}
    </div>
  );
}

function NovaEquipe() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    start(async () => {
      const r = await criarEquipe(name);
      if (!r.ok) setError(r.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium">Nova equipe</p>
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Ex.: Louvor, Som, Kids…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && add()}
          />
          <Button onClick={add} disabled={pending || !name.trim()}>
            <Plus className="size-4" /> Criar
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function TeamCard({ team, allProfiles }: { team: ManageableTeam; allProfiles: Profile[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border p-4">
        <TeamDot color={team.color} className="size-3" />
        <h2 className="text-lg font-semibold">{team.name}</h2>
      </div>

      {/* Membros */}
      <div className="border-b border-border">
        <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Membros</p>
        <MembersSection team={team} allProfiles={allProfiles} />
      </div>

      {/* Posições */}
      <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Posições</p>
      <ul className="divide-y divide-border">
        {team.positions.map((p) => (
          <li key={p.id} className="p-3 pl-4">
            <PositionItem positionId={p.id} teamId={team.id} name={p.name} />
          </li>
        ))}
      </ul>
      <div className="p-3">
        <AddPosition teamId={team.id} existing={team.positions.map((p) => p.name.toLowerCase())} />
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Membros
// -----------------------------------------------------------------------------
function MembersSection({ team, allProfiles }: { team: ManageableTeam; allProfiles: Profile[] }) {
  const [adding, setAdding] = useState(false);
  const memberIds = new Set(team.members.map((m) => m.profileId));
  const addable = allProfiles.filter((p) => !memberIds.has(p.id));

  return (
    <div>
      {team.members.length === 0 ? (
        <p className="px-4 py-2 text-sm text-muted-foreground">Ninguém na equipe ainda.</p>
      ) : (
        <ul className="divide-y divide-border">
          {team.members.map((m) => (
            <li key={m.membershipId} className="flex items-center gap-3 p-3 pl-4">
              <Avatar name={m.name} src={m.avatarUrl} className="size-8" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
              <RoleToggle membershipId={m.membershipId} teamId={team.id} role={m.role} />
              <RemoveMemberButton membershipId={m.membershipId} teamId={team.id} />
            </li>
          ))}
        </ul>
      )}
      <div className="p-3">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <UserPlus className="size-4" /> Adicionar pessoa
        </button>
      </div>
      <AddMemberModal open={adding} onClose={() => setAdding(false)} teamId={team.id} addable={addable} />
    </div>
  );
}

function RoleToggle({
  membershipId,
  teamId,
  role,
}: {
  membershipId: string;
  teamId: string;
  role: "leader" | "volunteer";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function set(next: "leader" | "volunteer") {
    if (next === role) return;
    start(async () => {
      const r = await definirPapelMembro(membershipId, teamId, next);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex overflow-hidden rounded-full border border-border text-xs">
      {(["volunteer", "leader"] as const).map((r) => (
        <button
          key={r}
          type="button"
          disabled={pending}
          onClick={() => set(r)}
          className={cn(
            "px-2.5 py-1 font-medium disabled:opacity-60",
            role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {r === "leader" ? (
            <span className="inline-flex items-center gap-1">
              <Crown className="size-3" /> Líder
            </span>
          ) : (
            "Voluntário"
          )}
        </button>
      ))}
    </div>
  );
}

function RemoveMemberButton({ membershipId, teamId }: { membershipId: string; teamId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    start(async () => {
      const r = await removerMembro(membershipId, teamId);
      if (r.ok) router.refresh();
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="destructive" onClick={remove} disabled={pending}>
          {pending ? "…" : "Tirar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Não
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Remover da equipe"
      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <X className="size-4" />
    </button>
  );
}

function AddMemberModal({
  open,
  onClose,
  teamId,
  addable,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  addable: Profile[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const filtered = addable.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  function add(profileId: string) {
    start(async () => {
      const r = await adicionarMembro(teamId, profileId, "volunteer");
      if (r.ok) router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()}>
      <div className="flex max-h-[80dvh] flex-col rounded-2xl border border-border bg-card shadow-lift">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold">Adicionar pessoa</h3>
          <input
            autoFocus
            className={cn(inputClass, "mt-2")}
            placeholder="Buscar por nome…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {addable.length === 0 ? "Todo mundo já está na equipe." : "Ninguém encontrado."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-muted disabled:opacity-50"
                  >
                    <Avatar name={p.name} src={p.avatarUrl} className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <Plus className="size-4 text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-3">
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={pending}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Posições
// -----------------------------------------------------------------------------
function PositionItem({
  positionId,
  teamId,
  name,
}: {
  positionId: string;
  teamId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirming, setConfirming] = useState(false);

  function save() {
    start(async () => {
      const r = await renomearPosicao(positionId, value, teamId);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function archive() {
    start(async () => {
      const r = await arquivarPosicao(positionId, teamId, true);
      if (r.ok) router.refresh();
      setConfirming(false);
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input className={inputClass} value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
        <button
          onClick={save}
          disabled={pending || !value.trim()}
          aria-label="Salvar"
          className="inline-flex size-8 items-center justify-center rounded-full text-success hover:bg-success/10"
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setValue(name);
          }}
          aria-label="Cancelar"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm">{name}</span>
      {confirming ? (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="destructive" onClick={archive} disabled={pending}>
            {pending ? "…" : "Arquivar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Não
          </Button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            aria-label="Renomear"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Pencil className="size-4" />
          </button>
          <button
            onClick={() => setConfirming(true)}
            aria-label="Arquivar"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Archive className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

function AddPosition({ teamId, existing }: { teamId: string; existing: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(value: string) {
    const nome = value.trim();
    if (!nome) return;
    setError(null);
    start(async () => {
      const r = await criarPosicao(teamId, nome);
      if (!r.ok) setError(r.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  const chips = SUGESTOES.filter((s) => !existing.includes(s.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Adicionar posição…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(name)}
        />
        <Button variant="outline" onClick={() => add(name)} disabled={pending || !name.trim()}>
          <Plus className="size-4" />
        </Button>
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.slice(0, 8).map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              disabled={pending}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
