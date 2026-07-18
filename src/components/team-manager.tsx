"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Pencil, Archive, UserPlus, Crown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { PessoaConfigModal, type TeamOpt } from "@/components/pessoa-config-modal";
import { cn } from "@/lib/utils";
import {
  criarEquipe,
  criarPosicao,
  renomearPosicao,
  arquivarPosicao,
  adicionarMembro,
} from "@/lib/actions";
import type { ManageableTeam, MemberRow } from "@/lib/data";

type Profile = { id: string; name: string; avatarUrl: string | null };

const inputClass =
  "w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SUGESTOES = [
  "Líder", "Vocal", "Guitarra", "Baixo", "Bateria", "Teclado",
  "Mesa de som", "Projeção", "Câmera", "Recepção", "Professor", "Auxiliar",
];

/**
 * Hub Equipes: um bloco por equipe (membros + posições). Tocar num membro abre
 * o PessoaConfigModal (equipes/papel/admin/excluir). Admin também cria equipes e
 * vê o bloco "Sem equipe". Layout responsivo: 1 coluna no celular, 2 no md+.
 */
export function TeamManager({
  teams,
  members,
  allProfiles,
  isAdmin,
  meId,
  canCreateTeam,
}: {
  teams: ManageableTeam[];
  members: MemberRow[];
  allProfiles: Profile[];
  isAdmin: boolean;
  meId: string;
  canCreateTeam: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const manageTeamOpts: TeamOpt[] = useMemo(
    () => teams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    [teams],
  );
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const noTeam = useMemo(
    () => members.filter((m) => m.status === "ativo" && m.teams.length === 0),
    [members],
  );
  const openPerson = openId ? byId.get(openId) ?? null : null;

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
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} allProfiles={allProfiles} onOpenPerson={setOpenId} />
          ))}
        </div>
      )}

      {isAdmin && noTeam.length > 0 ? (
        <Card>
          <div className="flex items-center gap-2 border-b border-border p-4">
            <span className="size-3 rounded-full bg-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Sem equipe</h2>
            <span className="ml-auto text-sm text-muted-foreground">{noTeam.length}</span>
          </div>
          <ul className="divide-y divide-border">
            {noTeam.map((p) => (
              <li key={p.id}>
                <PersonButton name={p.fullName} avatarUrl={p.avatarUrl} onClick={() => setOpenId(p.id)} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {openPerson ? (
        <PessoaConfigModal
          open
          onClose={() => setOpenId(null)}
          person={openPerson}
          manageTeams={manageTeamOpts}
          isAdmin={isAdmin}
          isSelf={openPerson.id === meId}
        />
      ) : null}
    </div>
  );
}

function PersonButton({
  name,
  avatarUrl,
  role,
  onClick,
}: {
  name: string;
  avatarUrl: string | null;
  role?: "leader" | "volunteer";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press-sm flex w-full items-center gap-3 p-3 pl-4 text-left hover:bg-muted/40"
    >
      <Avatar name={name} src={avatarUrl} className="size-8" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      {role === "leader" ? <Crown className="size-4 shrink-0 text-primary" /> : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </button>
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

function TeamCard({
  team,
  allProfiles,
  onOpenPerson,
}: {
  team: ManageableTeam;
  allProfiles: Profile[];
  onOpenPerson: (profileId: string) => void;
}) {
  return (
    <Card className="self-start">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <TeamDot color={team.color} className="size-3" />
        <h2 className="text-lg font-semibold">{team.name}</h2>
        <span className="ml-auto text-sm text-muted-foreground">{team.members.length}</span>
      </div>

      {/* Membros — tocar abre o modal de configuração */}
      <div className="border-b border-border">
        <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Membros</p>
        {team.members.length === 0 ? (
          <p className="px-4 py-2 text-sm text-muted-foreground">Ninguém na equipe ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {team.members.map((m) => (
              <li key={m.membershipId}>
                <PersonButton
                  name={m.name}
                  avatarUrl={m.avatarUrl}
                  role={m.role}
                  onClick={() => onOpenPerson(m.profileId)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="p-3">
          <AddMemberButton team={team} allProfiles={allProfiles} />
        </div>
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

function AddMemberButton({ team, allProfiles }: { team: ManageableTeam; allProfiles: Profile[] }) {
  const [adding, setAdding] = useState(false);
  const memberIds = new Set(team.members.map((m) => m.profileId));
  const addable = allProfiles.filter((p) => !memberIds.has(p.id));
  return (
    <>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <UserPlus className="size-4" /> Adicionar pessoa
      </button>
      <AddMemberModal open={adding} onClose={() => setAdding(false)} teamId={team.id} addable={addable} />
    </>
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
    <Modal open={open} onClose={() => !pending && onClose()} sheet title="Adicionar pessoa">
      <input
        autoFocus
        className={cn(inputClass, "mt-1")}
        placeholder="Buscar por nome…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-2 max-h-[55dvh] overflow-y-auto">
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
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Posições
// -----------------------------------------------------------------------------
function PositionItem({ positionId, teamId, name }: { positionId: string; teamId: string; name: string }) {
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
