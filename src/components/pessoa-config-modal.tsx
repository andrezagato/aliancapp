"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, X, Plus, ShieldCheck, Trash2, Cake } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/modal";
import { TeamDot } from "@/components/coverage-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { cn, displayName } from "@/lib/utils";
import { fmtBirthday } from "@/lib/format";
import {
  adicionarMembro,
  removerMembro,
  definirPapelMembro,
  definirAdmin,
  excluirPessoa,
  atualizarPessoaAdmin,
} from "@/lib/actions";
import type { MemberRow } from "@/lib/data";

export type TeamOpt = { id: string; name: string; color: string };

/**
 * Modal padrão de configuração de pessoa (bottom-sheet), reusado no hub Equipes
 * (admin e líder) e no fluxo de aprovar. Escopável: `manageTeams` = as equipes
 * que o usuário pode mexer (admin: todas; líder: as que lidera). `isAdmin`
 * libera o interruptor de admin e o excluir. Reusa as server actions existentes;
 * a pessoa/lista se atualiza via router.refresh() do pai.
 */
export function PessoaConfigModal({
  open,
  onClose,
  person,
  manageTeams,
  isAdmin,
  isSelf = false,
}: {
  open: boolean;
  onClose: () => void;
  person: MemberRow;
  manageTeams: TeamOpt[];
  isAdmin: boolean;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edição de dados (admin): nome/telefone/e-mail, pré-preenchidos com a pessoa.
  const [nome, setNome] = useState(person.fullName);
  const [phone, setPhone] = useState(person.phone ?? "");
  const [email, setEmail] = useState(person.email ?? "");
  const [bday, setBday] = useState(person.birthDate ?? "");
  useEffect(() => {
    setNome(person.fullName);
    setPhone(person.phone ?? "");
    setEmail(person.email ?? "");
    setBday(person.birthDate ?? "");
  }, [person.id, person.fullName, person.phone, person.email, person.birthDate]);
  const dadosDirty =
    nome !== person.fullName ||
    phone !== (person.phone ?? "") ||
    email !== (person.email ?? "") ||
    bday !== (person.birthDate ?? "");

  const manageableIds = new Set(manageTeams.map((t) => t.id));
  const personTeamsInScope = person.teams.filter((t) => manageableIds.has(t.teamId));
  const inTeam = new Set(person.teams.map((t) => t.teamId));
  const addable = manageTeams.filter((t) => !inTeam.has(t.id));

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, afterClose = false) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setErr(null);
        router.refresh();
        if (afterClose) onClose();
      } else {
        setErr(r.error ?? "Não foi possível concluir.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} sheet title={displayName(person.nickname, person.fullName)}>
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-3">
          <Avatar name={person.fullName} src={person.avatarUrl} className="size-11" />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {person.fullName}
              {person.systemRole === "admin" ? <Badge variant="primary" className="ml-2">Admin</Badge> : null}
            </p>
            {person.email ? <p className="truncate text-sm text-muted-foreground">{person.email}</p> : null}
            {person.birthDate ? (
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Cake className="size-3.5" /> {fmtBirthday(person.birthDate)}
              </p>
            ) : null}
          </div>
          {person.phone && !isSelf ? (
            <WhatsAppButton
              phone={person.phone}
              message={`Oi ${person.fullName.split(/\s+/)[0]}! 👋`}
              className="ml-auto shrink-0"
            />
          ) : null}
        </div>

        {isAdmin ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados</p>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefone (WhatsApp)"
              className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="E-mail"
              className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <label className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Cake className="size-3.5" /> Aniversário
              </span>
              <input
                value={bday}
                onChange={(e) => setBday(e.target.value)}
                type="date"
                className="flex-1 rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            {dadosDirty ? (
              <button
                disabled={pending}
                onClick={() => run(() => atualizarPessoaAdmin(person.id, { fullName: nome, phone, email, birthdate: bday }))}
                className="press-sm rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                Salvar dados
              </button>
            ) : null}
          </div>
        ) : null}

        {isAdmin ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acesso</p>
            <button
              disabled={pending}
              onClick={() => run(() => definirAdmin(person.id, person.systemRole !== "admin"))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
                person.systemRole === "admin"
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary",
              )}
            >
              <ShieldCheck className="size-3.5" />
              {person.systemRole === "admin" ? "Remover admin da igreja" : "Tornar admin da igreja"}
            </button>
          </div>
        ) : null}

        {personTeamsInScope.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipes</p>
            {personTeamsInScope.map((t) => (
              <div key={t.membershipId} className="flex items-center gap-2">
                <span className="flex flex-1 items-center gap-1.5 text-sm">
                  <TeamDot color={t.color} /> {t.name}
                  {t.role === "leader" ? <Crown className="size-3.5 text-primary" /> : null}
                </span>
                <div className="flex overflow-hidden rounded-full border border-border text-xs">
                  {(["volunteer", "leader"] as const).map((r) => (
                    <button
                      key={r}
                      disabled={pending}
                      onClick={() => t.role !== r && run(() => definirPapelMembro(t.membershipId, t.teamId, r))}
                      className={cn(
                        "px-2.5 py-1 font-medium disabled:opacity-60",
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
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {addable.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {personTeamsInScope.length > 0 ? "Adicionar a outra equipe" : "Adicionar a uma equipe"}
            </p>
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
        ) : personTeamsInScope.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma equipe pra gerenciar aqui.</p>
        ) : null}

        {err ? <p className="text-sm font-medium text-destructive">{err}</p> : null}

        {isAdmin && !isSelf ? (
          <div className="border-t border-border/60 pt-3">
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
                  onClick={() => run(() => excluirPessoa(person.id), true)}
                  className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:brightness-110 disabled:opacity-50"
                >
                  Excluir
                </button>
              </div>
            ) : (
              <button
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Excluir pessoa
              </button>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
