"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Crown, X, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { cn, displayName } from "@/lib/utils";
import { adicionarMembro, removerMembro, definirPapelMembro, definirAdmin, excluirPessoa } from "@/lib/actions";
import type { MemberRow } from "@/lib/data";

type TeamOpt = { id: string; name: string; color: string };
type SortKey = "nome" | "recentes";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function PeopleDirectory({ members, teams }: { members: MemberRow[]; teams: TeamOpt[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("nome");
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    const list = members.filter(
      (m) =>
        (!q || norm(m.fullName).includes(q) || norm(m.email ?? "").includes(q)) &&
        (!teamFilter || m.teams.some((t) => t.teamId === teamFilter)),
    );
    const sorted = [...list];
    if (sort === "recentes") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else sorted.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
    return sorted;
  }, [members, query, sort, teamFilter]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-base font-semibold">
          {teamFilter ? teams.find((t) => t.id === teamFilter)?.name ?? "Pessoas" : "Todas as pessoas"} · {shown.length}
        </h3>
      </div>

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-2xl border border-input bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Buscar por nome ou email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 text-xs">
          {([
            ["nome", "A–Z"],
            ["recentes", "Recentes"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={cn(
                "rounded-full px-3 py-1 font-medium",
                sort === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro por equipe (um por vez) */}
        {teams.length > 0 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 text-xs [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              onClick={() => setTeamFilter(null)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 font-semibold",
                teamFilter === null ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
              )}
            >
              Todas
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setTeamFilter(teamFilter === t.id ? null : t.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-semibold",
                  teamFilter === t.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} /> {t.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <Card className="border-dashed">
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">Ninguém encontrado.</div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((m) => (
              <li key={m.id}>
                <PersonRow
                  person={m}
                  teams={teams}
                  open={openId === m.id}
                  onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function PersonRow({
  person,
  teams,
  open,
  onToggle,
}: {
  person: MemberRow;
  teams: TeamOpt[];
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const inTeam = new Set(person.teams.map((t) => t.teamId));
  const addable = teams.filter((t) => !inTeam.has(t.id));

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setErr(null);
        router.refresh();
      } else {
        setErr(r.error ?? "Não foi possível concluir.");
      }
    });
  }

  return (
    <div className="p-4">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <Avatar name={person.fullName} src={person.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {displayName(person.nickname, person.fullName)}
            {person.nickname?.trim() ? <span className="font-normal text-muted-foreground"> · {person.fullName}</span> : null}
            {person.systemRole === "admin" ? <Badge variant="primary" className="ml-2">Admin</Badge> : null}
          </p>
          {person.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem equipe</p>
          ) : (
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {person.teams.map((t) => (
                <span key={t.membershipId} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <TeamDot color={t.color} /> {t.name}
                  {t.role === "leader" ? <Crown className="size-3 text-primary" /> : null}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acesso</p>
            <button
              disabled={pending}
              onClick={() => run(() => definirAdmin(person.id, person.systemRole !== "admin"))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50",
                person.systemRole === "admin"
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary",
              )}
            >
              <ShieldCheck className="size-3.5" />
              {person.systemRole === "admin" ? "Remover admin da igreja" : "Tornar admin da igreja"}
            </button>
          </div>

          {person.teams.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipes</p>
              {person.teams.map((t) => (
                <div key={t.membershipId} className="flex items-center gap-2">
                  <span className="flex flex-1 items-center gap-1.5 text-sm">
                    <TeamDot color={t.color} /> {t.name}
                  </span>
                  <div className="flex overflow-hidden rounded-full border border-border text-xs">
                    {(["volunteer", "leader"] as const).map((r) => (
                      <button
                        key={r}
                        disabled={pending}
                        onClick={() => t.role !== r && run(() => definirPapelMembro(t.membershipId, t.teamId, r))}
                        className={cn(
                          "px-2 py-0.5 font-medium disabled:opacity-60",
                          t.role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {r === "leader" ? "Líder" : "Voluntário"}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => run(() => removerMembro(t.membershipId, t.teamId))}
                    aria-label={`Remover de ${t.name}`}
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive-ink"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {addable.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adicionar a uma equipe</p>
              <div className="flex flex-wrap gap-1.5">
                {addable.map((t) => (
                  <button
                    key={t.id}
                    disabled={pending}
                    onClick={() => run(() => adicionarMembro(t.id, person.id, "volunteer"))}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-50"
                  >
                    <Plus className="size-3" /> <TeamDot color={t.color} /> {t.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Já está em todas as equipes.</p>
          )}

          {err ? <p className="text-xs font-medium text-destructive-ink">{err}</p> : null}

          <div className="border-t border-border/60 pt-2.5">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground">
                  Excluir {displayName(person.nickname, person.fullName)} de vez?
                </span>
                <button
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={pending}
                  onClick={() => run(() => excluirPessoa(person.id))}
                  className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:brightness-110 disabled:opacity-50"
                >
                  Excluir
                </button>
              </div>
            ) : (
              <button
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive-ink hover:underline disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Excluir pessoa
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
