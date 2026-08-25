"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/coverage-badge";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  criarConvite,
  criarEquipe,
  cancelarConvite,
  aprovarJoinRequest,
  recusarJoinRequest,
  aprovarProfilePendente,
  excluirPessoa,
  reconvidar,
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
// Adicionar (convidar pessoa OU criar equipe) — um "+" só no cabeçalho, com
// abas dentro, no lugar de duas entradas separadas na tela.
// -----------------------------------------------------------------------------
export function AdminAddSheet({ teams }: { teams: TeamOpt[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pessoa" | "equipe">("pessoa");
  // Direção do deslize: "Nova equipe" está à DIREITA na barra de abas, então ela
  // entra pela direita (`animate-push`) e "Convidar pessoa" volta pela esquerda
  // (`animate-pull`). É o mesmo vocabulário dos painéis do sheet de escala
  // (event-escala-modal.tsx, Fase 4.2) — mesma curva, mesma duração do sheet.
  // `undefined` no primeiro render: o painel inicial não desliza, ele já está lá.
  const [anim, setAnim] = useState<string | undefined>(undefined);

  const trocarAba = (t: "pessoa" | "equipe") => {
    if (t === tab) return;
    setAnim(t === "equipe" ? "animate-push" : "animate-pull");
    setTab(t);
  };

  const aba = (t: "pessoa" | "equipe", rotulo: string) => (
    <button
      type="button"
      onClick={() => trocarAba(t)}
      aria-selected={tab === t}
      role="tab"
      className={cn(
        "flex-1 px-3 py-1.5 transition-colors",
        tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {rotulo}
    </button>
  );

  return (
    <>
      <Button
        size="icon"
        onClick={() => {
          setTab("pessoa");
          setAnim(undefined);
          setOpen(true);
        }}
        aria-label="Convidar pessoa ou criar equipe"
      >
        <Plus className="size-5" />
      </Button>
      {/* Título FIXO: ele trocava junto com a aba e, com o painel deslizando por
          baixo, a troca de golpe lia como falha de renderização. Quem nomeia as
          duas coisas são as abas, logo abaixo — repetir isso no título era
          dizer duas vezes e ainda piscar. */}
      <Modal open={open} onClose={() => setOpen(false)} sheet title="Adicionar">
        <div className="space-y-4">
          <div role="tablist" className="flex overflow-hidden rounded-full border border-border text-[13px] font-semibold">
            {aba("pessoa", "Convidar pessoa")}
            {aba("equipe", "Nova equipe")}
          </div>

          {/* ALTURA ÚNICA pros dois painéis. Sem isto o sheet é ancorado embaixo
              (`items-end` no Modal) e trocar de aba faz ele SALTAR — "Convidar
              pessoa" tem três campos, a lista de equipes e o checkbox de admin;
              "Nova equipe" tem um campo só.
              `vh` e não `dvh`/`svh` de propósito: `dvh` encolhe quando o teclado
              do iOS abre, e o painel desabaria no meio da digitação. `vh` é a
              viewport grande e não se mexe.
              `overflow-hidden` é obrigatório: o painel que entra começa em
              translateX(±100%) e, sem o corte, o sheet (que é `overflow-y-auto`,
              o que faz o eixo X computar `auto`) ganharia barra horizontal. */}
          <div className="relative h-[min(58vh,440px)] overflow-hidden">
            <div key={tab} className={cn("h-full", anim)}>
              {tab === "pessoa" ? (
                <ConvidarFields teams={teams} onDone={() => setOpen(false)} />
              ) : (
                <NovaEquipeFields onDone={() => setOpen(false)} />
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ConvidarFields({ teams, onDone }: { teams: TeamOpt[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pickedTeams, setPickedTeams] = useState<InviteTeamInput[]>([]);

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
      setFullName("");
      setEmail("");
      setPhone("");
      setIsAdmin(false);
      setPickedTeams([]);
      onDone();
      router.refresh();
    });
  }

  return (
    // `h-full` + rolagem interna: este painel é mais alto que a caixa comum das
    // abas, e a decisão foi aceitar um scroll aqui em vez do sheet pular de
    // altura. `overscroll-contain` impede que o fim da rolagem deste painel
    // continue rolando a página atrás (ver a trava em modal.tsx).
    <div className="h-full space-y-4 overflow-y-auto overscroll-contain pb-1 pr-0.5">
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

      {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={submit} disabled={pending || !email.trim()}>
          {pending ? "Enviando…" : "Convidar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A pessoa entra direto ao logar com o Google usando este email.
      </p>
    </div>
  );
}

function NovaEquipeFields({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    start(async () => {
      const r = await criarEquipe(name);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setName("");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto overscroll-contain pb-1 pr-0.5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nome da equipe</span>
        {/* Sem `autoFocus`: com a troca de aba deslizando e a altura do painel
            travada, o teclado do iOS subia no meio da animação sobre uma caixa
            que não compensa (o sheet só ganha `liftY` onde o campo é o assunto). */}
        <input
          className={inputClass}
          placeholder="Ex.: Louvor, Som, Kids…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && add()}
        />
      </label>
      {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={add} disabled={pending || !name.trim()}>
          {pending ? "Criando…" : "Criar equipe"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Cor, posições e quem lidera se ajustam depois, dentro da equipe.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Modal de aprovação (escolhe equipes/papel antes de liberar) — compartilhado
// -----------------------------------------------------------------------------
function AprovarModal({
  open,
  onClose,
  teams,
  pending,
  error,
  onConfirm,
  initialTeamId,
}: {
  open: boolean;
  onClose: () => void;
  teams: TeamOpt[];
  pending: boolean;
  error: string | null;
  onConfirm: (picked: InviteTeamInput[]) => void;
  initialTeamId?: string | null;
}) {
  const [picked, setPicked] = useState<InviteTeamInput[]>(
    initialTeamId ? [{ teamId: initialTeamId, role: "volunteer" }] : [],
  );
  return (
    <Modal open={open} onClose={() => !pending && onClose()} sheet title="Aprovar entrada">
      <p className="mt-1 text-sm text-muted-foreground">Escolha as equipes e quem é líder — dá pra ajustar depois.</p>
      <div className="mt-3">
        <TeamPicker teams={teams} value={picked} onChange={setPicked} />
      </div>
      {error ? <p className="mt-2 text-sm text-destructive-ink">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={() => onConfirm(picked)} disabled={pending}>
          {pending ? "Aprovando…" : "Confirmar entrada"}
        </Button>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Aprovar / recusar auto-cadastro (join_request)
// -----------------------------------------------------------------------------
export function JoinRequestActions({
  joinId,
  teams,
  desiredTeamId,
}: {
  joinId: string;
  teams: TeamOpt[];
  desiredTeamId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Mesmo motivo do `ReconvidarButton`: `aprovarJoinRequest` revalida ANTES de
  // devolver `fail` nos caminhos pós-escrita (o pedido já virou `aprovado`), a
  // linha some da fila, este componente desmonta, e o `setError` não tem onde
  // escrever. O toast mora no layout e sobrevive.
  const { showToast } = useToast();
  const falhou = (msg: string) => {
    setError(msg);
    showToast(msg);
  };

  function approve(picked: InviteTeamInput[]) {
    setError(null);
    start(async () => {
      const r = await aprovarJoinRequest(joinId, picked);
      if (!r.ok) falhou(r.error ?? "Erro");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }
  function reject() {
    setError(null);
    start(async () => {
      const r = await recusarJoinRequest(joinId);
      if (!r.ok) falhou(r.error ?? "Erro");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={reject} disabled={pending}>
          Recusar
        </Button>
        <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
          Aprovar
        </Button>
      </div>
      {error && !open ? <p className="text-xs text-destructive-ink">{error}</p> : null}
      <AprovarModal
        open={open}
        onClose={() => setOpen(false)}
        teams={teams}
        pending={pending}
        error={open ? error : null}
        onConfirm={approve}
        initialTeamId={desiredTeamId}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Aprovar profile pendente (logou sem convite) com equipes
// -----------------------------------------------------------------------------
export function PendingProfileActions({
  profileId,
  teams,
  allowReject = true,
  desiredTeamId,
  joinId,
}: {
  profileId: string;
  teams: TeamOpt[];
  allowReject?: boolean;
  desiredTeamId?: string | null;
  /**
   * LINHA FUNDIDA: a mesma pessoa pediu pelo formulário E logou, então existia
   * um `join_request` além do perfil pendente. Antes eram duas linhas na fila
   * com dois botões Aprovar — e tocar no do FORMULÁRIO criava um convite cujo
   * link é recusado com `ja_tem_conta`, porque a conta dela já existe. É o bug
   * da Rayane por caminho novo. Agora é uma linha só, e o Aprovar é sempre o do
   * perfil (que dá acesso imediato e resolve o pedido junto).
   *
   * O `joinId` sobrevive por causa do RECUSAR: hoje o líder pode recusar um
   * pedido (`recusarJoinRequest`) mas não pode excluir um perfil — só admin. Se
   * a fusão usasse o recusar do perfil, o líder PERDERIA um poder que já tem.
   * Com o `joinId` em mãos ele recusa o pedido, exatamente como antes da fusão.
   */
  joinId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve(picked: InviteTeamInput[]) {
    setError(null);
    start(async () => {
      const r = await aprovarProfilePendente({ profileId, teams: picked });
      if (!r.ok) setError(r.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }
  function reject() {
    setError(null);
    start(async () => {
      // Com `joinId`, recusar é recusar O PEDIDO — não excluir a pessoa.
      // São coisas diferentes e o líder só pode a primeira. Recusar o pedido
      // deixa o perfil pendente de pé, que é EXATAMENTE o que já acontecia
      // quando as duas linhas eram separadas: o Recusar do formulário nunca
      // encostou no perfil. A fusão não pode mudar isso por tabela.
      const r = joinId ? await recusarJoinRequest(joinId) : await excluirPessoa(profileId);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {confirmReject ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReject(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button size="sm" variant="destructive" onClick={reject} disabled={pending}>
              Confirmar recusa
            </Button>
          </>
        ) : (
          <>
            {allowReject ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmReject(true)} disabled={pending}>
                Recusar
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setOpen(true)}>
              Aprovar
            </Button>
          </>
        )}
      </div>
      {error && !open ? <p className="text-xs text-destructive-ink">{error}</p> : null}
      <AprovarModal
        open={open}
        onClose={() => setOpen(false)}
        teams={teams}
        pending={pending}
        error={open ? error : null}
        onConfirm={approve}
        initialTeamId={desiredTeamId}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Cancelar convite pendente
// -----------------------------------------------------------------------------
export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // O `r.error` era descartado, então as três frases de falha do
  // `cancelarConvite` não existiam pra ninguém: o admin clicava, nada
  // acontecia, nada aparecia, a linha ficava lá. Os dois vizinhos deste mesmo
  // arquivo ganharam toast nesta branch; este ficou pra trás justamente quando
  // a action dele ganhou as guardas novas.
  const { showToast } = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelarConvite(inviteId);
          if (r.ok) router.refresh();
          else showToast(r.error);
        })
      }
    >
      Cancelar
    </Button>
  );
}

// -----------------------------------------------------------------------------
// Reconvidar — devolve uma chave viva pra quem travou
// -----------------------------------------------------------------------------
/**
 * Sólido, não fantasma como o "Cancelar" ao lado: numa lista onde todo o resto
 * é "decida sobre esta pessoa", esta é a única linha em que a decisão já foi
 * tomada e o que falta é consertar. O botão que conserta é o que se vê primeiro.
 *
 * O alvo é um ID, nunca o e-mail — quem escolhe pra qual caixa o link vai é o
 * servidor, lendo a linha (ver `reconvidar` em actions.ts).
 */
export function ReconvidarButton({ alvo }: { alvo: { tipo: "convite" | "pedido"; id: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  // TOAST ALÉM DO ERRO NA LINHA. Várias actions chamam `revalidatePath` no
  // caminho de FALHA, de propósito — a instrução costuma pedir pra olhar outra
  // linha. Só que revalidar REMONTA esta linha (a chave muda de `s-pedido-…`
  // pra `s-convite-…` quando a pessoa passa a ter convite), e o `useState` do
  // erro morre antes de alguém ler. O toast mora no layout do app e sobrevive à
  // remontagem; o texto na linha fica como reforço pra quando ela não remonta.
  const { showToast } = useToast();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErro(null);
            const r = await reconvidar(alvo);
            if (r.ok) {
              router.refresh();
            } else {
              setErro(r.error);
              showToast(r.error);
            }
          })
        }
      >
        {pending ? "Enviando…" : "Reconvidar"}
      </Button>
      {erro ? <span className="text-[11px] text-destructive-ink">{erro}</span> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Linha unificada de "Entrando na igreja" (pedido de entrada, perfil pendente
// ou convite) — mesma origem visual, email/telefone/recado atrás do toque.
// -----------------------------------------------------------------------------
export function EntradaRow({
  fullName,
  avatarUrl,
  email,
  phone,
  message,
  teamDot,
  line2,
  chip,
  actions,
}: {
  fullName: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  teamDot?: string | null;
  line2: string;
  /** Selo ao lado do nome. Hoje só o "Travado" usa — ver `listStuckEntries`. */
  chip?: ReactNode;
  actions: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(email || phone || message);

  return (
    <div className="p-3.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => hasDetail && setExpanded((v) => !v)}
          className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", !hasDetail && "cursor-default")}
        >
          <Avatar name={fullName} src={avatarUrl} className="size-9" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-bold text-foreground">{fullName}</span>
              {chip}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
              {teamDot ? <TeamDot color={teamDot} /> : null}
              {line2}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {hasDetail ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Recolher contato" : "Ver contato"}
              className="press-sm grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[13px] text-muted-foreground">
          {email ? <p className="truncate">{email}</p> : null}
          {phone ? <p>{phone}</p> : null}
          {message ? <p className="italic">“{message}”</p> : null}
        </div>
      ) : null}
    </div>
  );
}
