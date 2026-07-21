import Link from "next/link";
import { Mail, Phone, Cake, History, Bell, CalendarOff, ChevronRight, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileEditableField } from "@/components/profile-field";
import { ChurchLocationCard } from "@/components/church-location-card";
import { atualizarNome, atualizarApelido, atualizarTelefone, atualizarAniversario } from "@/lib/actions";
import { cn, displayName } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { getChurchLocation } from "@/lib/data";
import { fmtBirthday } from "@/lib/format";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) return null;
  const p = session.profile;
  const churchLoc = session.role === "admin" ? await getChurchLocation(session) : null;

  const roleLabel =
    session.role === "admin" ? "Administrador" : session.role === "leader" ? "Líder" : "Voluntário";
  const hasContact = !!(p.email || p.phone || p.birth_date);

  return (
    <div className="space-y-3 pb-4 pt-safe">
      {/* Cabeçalho vinho */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[hsl(349_72%_28%)] to-[hsl(349_69%_15%)] p-6 text-center text-primary-foreground shadow-lift">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.4), transparent 68%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col items-center">
          <Avatar
            name={p.full_name || "?"}
            src={p.avatar_url}
            className="size-20 border-[3px] border-white/25 bg-accent text-2xl text-primary"
          />
          <h1 className="mt-3 font-display text-2xl font-extrabold text-white">{displayName(p.nickname, p.full_name)}</h1>
          {p.nickname?.trim() ? <p className="text-[12.5px] text-primary-foreground/70">{p.full_name}</p> : null}
          <p className="text-[13.5px] text-primary-foreground/85">{roleLabel}</p>
          {p.teams.length > 0 ? (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {p.teams.map((t) => (
                <span key={t.id} className="rounded-full bg-white/[0.14] px-3 py-1 text-[12.5px] font-medium">
                  {t.name}
                  {t.role === "leader" ? " · líder" : ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {hasContact ? (
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4 text-sm text-muted-foreground">
            {p.email ? (
              <span className="inline-flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground/70" /> {p.email}
              </span>
            ) : null}
            {p.phone ? (
              <span className="inline-flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground/70" /> {p.phone}
              </span>
            ) : null}
            {p.birth_date ? (
              <span className="inline-flex items-center gap-2">
                <Cake className="size-4 text-muted-foreground/70" /> {fmtBirthday(p.birth_date)}
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border/70">
          <li>
            <ProfileEditableField
              label="Nome"
              current={p.full_name}
              placeholder="Seu nome completo"
              emptyHint="Toque para definir seu nome"
              required
              action={atualizarNome}
            />
          </li>
          <li>
            <ProfileEditableField
              label="Apelido"
              current={p.nickname}
              placeholder="Ex.: Maui"
              emptyHint="Como querem te chamar (ex.: Maui)"
              action={atualizarApelido}
            />
          </li>
          <li>
            <ProfileEditableField
              label="Telefone (WhatsApp)"
              current={p.phone}
              placeholder="(11) 99999-9999"
              emptyHint="Toque para adicionar seu WhatsApp"
              action={atualizarTelefone}
            />
          </li>
          <li>
            <ProfileEditableField
              label="Aniversário"
              current={p.birth_date}
              displayValue={fmtBirthday(p.birth_date)}
              placeholder="Sua data de nascimento"
              emptyHint="Toque para adicionar seu aniversário"
              type="date"
              action={atualizarAniversario}
            />
          </li>
          <ProfileRow href="/jornada" icon={<Trophy className="size-[18px]" />} tone="accent" label="Minha Jornada" />
          <ProfileRow href="/historico" icon={<History className="size-[18px]" />} tone="primary" label="Histórico de escalas" />
          <ProfileRow href="/notificacoes" icon={<Bell className="size-[18px]" />} tone="accent" label="Notificações" />
          <ProfileRow
            href="/disponibilidade"
            icon={<CalendarOff className="size-[18px]" />}
            tone="success"
            label="Datas indisponíveis"
          />
          <li>
            <SignOutButton
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3.5 text-[15px] font-semibold text-destructive hover:bg-destructive/5"
            />
          </li>
        </ul>
      </Card>

      {session.role === "admin" ? <ChurchLocationCard location={churchLoc} /> : null}

      <p className="text-center font-display text-xs italic text-muted-foreground/70">Sirvo · Aliança · v1.0</p>
    </div>
  );
}

function ProfileRow({
  href,
  icon,
  tone,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  tone: "primary" | "accent" | "success";
  label: string;
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "accent"
        ? "bg-accent/15 text-accent"
        : "bg-success/12 text-success";
  return (
    <li>
      <Link href={href} className="press-sm flex items-center gap-3 px-4 py-3.5">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px]", toneClass)}>{icon}</span>
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
      </Link>
    </li>
  );
}
