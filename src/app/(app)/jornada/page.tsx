import { getSession } from "@/lib/auth";
import { getMyJourney, type JourneyBadge } from "@/lib/data";
import { BADGES } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function JornadaPage() {
  const session = await getSession();
  if (!session) return null;
  const journey = await getMyJourney(session);
  const first = session.profile.full_name?.split(/\s+/)[0] || "Você";
  const m = journey.metrics;

  return (
    <div className="space-y-4 pb-6 pt-safe">
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

      {/* Números */}
      <div className="grid grid-cols-2 gap-3">
        <Stat emoji="🙌" value={m.servido} label={m.servido === 1 ? "culto servido" : "cultos servidos"} />
        <Stat emoji="🌍" value={m.ministerios} label={m.ministerios === 1 ? "ministério" : "ministérios"} />
        <Stat emoji="📅" value={m.meses} label={m.meses === 1 ? "mês servindo" : "meses servindo"} />
        <Stat emoji="🔥" value={m.streak} label="na sequência" />
      </div>

      {/* Conquistas */}
      <section>
        <h3 className="mb-2 px-1 font-display text-lg font-bold">Conquistas</h3>
        <div className="grid grid-cols-2 gap-3">
          {journey.badges.map((b) => (
            <BadgeCard key={b.code} b={b} />
          ))}
        </div>
      </section>

      <p className="text-center font-display text-xs italic text-muted-foreground/70">
        Servir é sobre gente e não sobre placar — mas comemorar a caminhada é gostoso. 💛
      </p>
    </div>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{emoji}</span>
        <span className="font-display text-3xl font-extrabold tabular-nums text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-[13px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function BadgeCard({ b }: { b: JourneyBadge }) {
  const isNew = b.unlocked && b.unlockedAt ? Date.now() - new Date(b.unlockedAt).getTime() < WEEK_MS : false;
  const pct = Math.min(100, Math.round((b.current / b.target) * 100));

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[18px] border p-4",
        b.unlocked
          ? "border-accent/50 bg-gradient-to-br from-accent/15 to-accent/25 shadow-soft"
          : "border-border bg-muted/30",
      )}
    >
      {isNew ? (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">
          Novo!
        </span>
      ) : null}
      <span className={cn("text-3xl leading-none", b.unlocked ? "" : "opacity-30 grayscale")}>{b.emoji}</span>
      <p className={cn("mt-2 text-sm font-bold leading-tight", b.unlocked ? "text-foreground" : "text-muted-foreground")}>
        {b.title}
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{b.desc}</p>

      {!b.unlocked && b.target > 1 ? (
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground tabular-nums">
            {b.current}/{b.target}
          </p>
        </div>
      ) : null}
    </div>
  );
}
