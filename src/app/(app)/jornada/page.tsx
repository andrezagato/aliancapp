import { ChevronDown } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getMyJourney, type JourneyBadge } from "@/lib/data";
import { BADGES, BADGE_BY_CODE } from "@/lib/achievements";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export default async function JornadaPage() {
  const session = await getSession();
  if (!session) return null;
  const journey = await getMyJourney(session);
  const first = session.profile.full_name?.split(/\s+/)[0] || "Você";
  const m = journey.metrics;

  // journey.badges já vem ordenado: desbloqueadas (mais recente primeiro), depois bloqueadas (mais perto de bater primeiro).
  const unlocked = journey.badges.filter((b) => b.unlocked);
  const featured = unlocked.slice(0, 2);
  const featuredCodes = new Set(featured.map((b) => b.code));
  const passos = journey.badges.filter((b) => BADGE_BY_CODE[b.code]?.group === "passos" && !featuredCodes.has(b.code));
  const jornada = journey.badges.filter((b) => BADGE_BY_CODE[b.code]?.group !== "passos" && !featuredCodes.has(b.code));

  return (
    <div className="space-y-3 pb-6 pt-safe">
      {/* Cabeçalho vinho */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[hsl(349_72%_28%)] to-[hsl(349_69%_15%)] p-6 text-primary-foreground shadow-lift">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.42), transparent 68%)" }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Minha Jornada</p>
          <h1 className="mt-1 font-display text-[26px] font-extrabold leading-tight text-white">
            A caminhada de {first}
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/85">
            {journey.unlockedCount} de {BADGES.length} conquistas · obrigado por servir 🙏
          </p>
        </div>
      </div>

      {/* Números — um papel só, quatro colunas */}
      <div className="grid grid-cols-4 divide-x divide-border rounded-[18px] border border-border bg-card shadow-soft">
        <StatCell emoji="🙌" value={m.servido} label={m.servido === 1 ? "culto" : "cultos"} />
        <StatCell emoji="🌍" value={m.ministerios} label={m.ministerios === 1 ? "equipe" : "equipes"} />
        <StatCell emoji="📅" value={m.meses} label={m.meses === 1 ? "mês" : "meses"} />
        <StatCell emoji="🔥" value={m.streak} label="sequência" />
      </div>

      {/* As duas conquistas mais recentes, de qualquer grupo — em destaque */}
      {featured.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {featured.map((b) => (
            <BadgeCard key={b.code} b={b} />
          ))}
        </div>
      ) : null}

      {/* Primeiros passos — conquistas de onboarding, separadas de propósito:
          medalha de 30 segundos não disputa espaço com "100 cultos servidos". */}
      {passos.length > 0 ? <BadgeGroupSection title="Primeiros passos" badges={passos} /> : null}

      {jornada.length > 0 ? <BadgeGroupSection title="Minha jornada" badges={jornada} /> : null}

      <p className="text-center font-display text-xs italic text-muted-foreground/70">
        Servir é sobre gente e não sobre placar — mas comemorar a caminhada é gostoso. 💛
      </p>
    </div>
  );
}

function StatCell({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 p-3 text-center">
      <span className="text-lg leading-none">{emoji}</span>
      <span className="font-display text-xl font-extrabold tabular-nums text-foreground">{value}</span>
      <p className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function BadgeCard({ b }: { b: JourneyBadge }) {
  const isNew = b.unlockedAt ? Date.now() - new Date(b.unlockedAt).getTime() < WEEK_MS : false;

  return (
    <div className="relative flex flex-col rounded-[18px] border border-accent/50 bg-gradient-to-br from-accent/15 to-accent/25 p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-3xl leading-none">{b.emoji}</span>
        {isNew ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">
            Novo!
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-bold leading-tight text-foreground">{b.title}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{b.desc}</p>
    </div>
  );
}

function BadgeGroupSection({ title, badges }: { title: string; badges: JourneyBadge[] }) {
  const rowsUnlocked = badges.filter((b) => b.unlocked);
  const rowsLocked = badges.filter((b) => !b.unlocked);
  const visibleLocked = rowsLocked.slice(0, 3);
  const restLocked = rowsLocked.slice(3);

  return (
    <section className="space-y-2">
      <h3 className="px-1 font-display text-lg font-bold">{title}</h3>

      {rowsUnlocked.length > 0 ? (
        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-soft">
          <ul className="divide-y divide-border/70">
            {rowsUnlocked.map((b) => (
              <li key={b.code} className="flex items-center gap-3 p-3.5">
                <span className="text-lg leading-none">{b.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight text-foreground">{b.title}</p>
                  <p className="truncate text-[12px] leading-snug text-muted-foreground">{b.desc}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {b.unlockedAt ? monthLabel(b.unlockedAt) : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rowsLocked.length > 0 ? (
        <div className="overflow-hidden rounded-[18px] border border-border bg-muted/30">
          <ul className="divide-y divide-border/70">
            {visibleLocked.map((b) => (
              <LockedRow key={b.code} b={b} />
            ))}
          </ul>
          {restLocked.length > 0 ? (
            <details className="group border-t border-border/70">
              <summary className="press-sm flex cursor-pointer list-none items-center justify-center gap-1 p-3 text-[13px] font-semibold text-primary">
                Ver as outras {restLocked.length}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-border/70 border-t border-border/70">
                {restLocked.map((b) => (
                  <LockedRow key={b.code} b={b} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function LockedRow({ b }: { b: JourneyBadge }) {
  const pct = Math.min(100, Math.round((b.current / b.target) * 100));
  return (
    <li className="flex items-center gap-3 p-3.5">
      <span className="text-lg leading-none opacity-30 grayscale">{b.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-muted-foreground">{b.title}</p>
        {b.target > 1 ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      {b.target > 1 ? (
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          {b.current}/{b.target}
        </span>
      ) : null}
    </li>
  );
}
