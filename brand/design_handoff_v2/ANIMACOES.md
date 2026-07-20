# Sirvo — camada de animação ("tato" no talo)

Referência viva: `Sirvo Animado.dc.html`. Alvo: branch `feat/fase-4`.
Objetivo: deixar o app **super reativo** — conquista comemorada de verdade,
modais que abrem/fecham com mola, transição ao trocar de página, nav animada e
microanimações. Exagerar primeiro; calibrar depois (todos os tempos abaixo são
fáceis de reduzir).

Ordem sugerida: (1) tokens de animação → (2) conquista → (3) modal → (4)
transição de rota → (5) bottom-nav.

Todas as cores/tempos respeitam `prefers-reduced-motion` (já tratado no
`globals.css` existente, que zera durações).

---

## 1) `src/app/globals.css` — novos keyframes + utilitários

Cole **antes** do bloco `@media (pointer: fine)`. Não mexe no que já existe
(as classes `animate-*` do `tailwind.config.ts` continuam valendo).

```css
/* ===== camada de animação "tato" ===== */
@keyframes confetti-fly {
  0%   { opacity: 0; transform: translate(0,0) rotate(0) scale(.3); }
  12%  { opacity: 1; }
  100% { opacity: 0; transform: var(--to) rotate(var(--rot)) scale(1); }
}
@keyframes spring-in {
  0%   { opacity: 0; transform: scale(.72); }
  55%  { transform: scale(1.07); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes emoji-pop {
  0%   { transform: scale(0) rotate(-28deg); }
  62%  { transform: scale(1.28) rotate(9deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes page-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}
@keyframes sheet-out {
  from { transform: translateY(0); }
  to   { transform: translateY(104%); }
}
@keyframes scrim-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes nav-pop {
  0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); }
}

@layer utilities {
  .anim-spring   { animation: spring-in .55s cubic-bezier(.32,.72,.24,1) both; }
  .anim-emoji    { animation: emoji-pop .6s .1s cubic-bezier(.34,1.56,.64,1) both; }
  .confetti-pc   { position: absolute; top: 46%; left: 50%; animation: confetti-fly 1.15s ease-out forwards; }
  .page-in       { animation: page-in .34s cubic-bezier(.32,.72,.24,1) both; }
  .animate-sheet-out { animation: sheet-out .28s cubic-bezier(.32,.72,.24,1) both; }
  .animate-scrim-out { animation: scrim-out .24s ease both; }
  .nav-pop       { animation: nav-pop .4s ease; }
}
```

---

## 2) `src/components/achievement-celebration.tsx` — comemoração em leque

Substitua o arquivo inteiro. Mantém o comportamento (toque avança, fila de
badges) e melhora: confete disparado em **leque a partir do centro**, card com
mola, emoji "estourando", glow pulsando.

```tsx
"use client";

import { useState, useMemo } from "react";
import type { UnlockedBadge } from "@/lib/achievements";

const SPARKS = ["🎉", "✨", "⭐", "🎊", "💛", "🔥", "🙌"];

/** Comemoração em tela cheia ao desbloquear conquista(s). Toque avança. */
export function AchievementCelebration({ badges, onDone }: { badges: UnlockedBadge[]; onDone: () => void }) {
  const [i, setI] = useState(0);

  // confete em leque — direções/rotações determinísticas (sem random → sem mismatch)
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, k) => {
        const ang = (k / 16) * Math.PI * 2 + (k % 2 ? 0.3 : -0.25);
        const dist = 150 + (k % 3) * 46;
        return {
          e: SPARKS[k % SPARKS.length],
          to: `translate(${Math.round(Math.cos(ang) * dist)}px, ${Math.round(Math.sin(ang) * dist - 40)}px)`,
          rot: `${(k % 2 ? 1 : -1) * (140 + (k % 4) * 40)}deg`,
          delay: (k % 6) * 55,
          size: 18 + (k % 3) * 8,
        };
      }),
    [],
  );

  if (badges.length === 0) return null;
  const b = badges[i];
  const advance = () => (i + 1 < badges.length ? setI(i + 1) : onDone());

  return (
    <div
      role="dialog"
      aria-modal
      onClick={advance}
      className="fixed inset-0 z-[120] flex animate-fade-in items-center justify-center bg-black/60 p-6"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p, k) => (
          <span
            key={k}
            className="confetti-pc"
            style={{ ["--to" as string]: p.to, ["--rot" as string]: p.rot, animationDelay: `${p.delay}ms`, fontSize: p.size }}
          >
            {p.e}
          </span>
        ))}
      </div>

      <div className="anim-spring relative w-full max-w-xs rounded-[26px] bg-card p-7 text-center shadow-lift">
        <div className="relative mx-auto grid size-24 place-items-center">
          <div
            className="absolute inset-0 animate-glow rounded-full"
            style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5), transparent 68%)" }}
            aria-hidden
          />
          <span className="anim-emoji relative text-6xl leading-none">{b.emoji}</span>
        </div>
        <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
          Conquista desbloqueada!
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-foreground">{b.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
          className="press mt-5 h-12 w-full rounded-[15px] bg-primary text-[15.5px] font-extrabold text-primary-foreground"
        >
          {i + 1 < badges.length ? `Próxima (${i + 1}/${badges.length})` : "Boa! 🎉"}
        </button>
      </div>
    </div>
  );
}
```

---

## 3) `src/components/modal.tsx` — fechar com animação de saída

Hoje o sheet sobe com mola mas some **de vez** ao fechar. Adicione um estado
`closing` que segura o sheet montado ~280ms tocando `animate-sheet-out` +
`animate-scrim-out`, então desmonta. Diffs pontuais:

**a)** adicione estado e um `requestClose` que anima antes de fechar:

```tsx
  const [closing, setClosing] = useState(false);
  // ...dentro do componente, junto aos outros estados

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setDy(0);
      onClose();
    }, 280);
  };
```

**b)** troque as chamadas de fechamento por `requestClose`:
- `onKey`: `e.key === "Escape" && requestClose()`
- o `<div ... onClick={onClose}>` do wrapper → `onClick={requestClose}`
- o botão `×` (`onClick={onClose}`) → `onClick={requestClose}`
- no `onUp`, `if (ddy > CLOSE_DY) onClose();` → `requestClose();`

**c)** aplique as classes de saída quando `closing`:

```tsx
// véu
className={cn("absolute inset-0 bg-[hsl(var(--foreground)/0.42)]", closing ? "animate-scrim-out" : "animate-scrim")}

// container do sheet: acrescente a classe de saída
cn(
  closing ? "animate-sheet-out" : "animate-sheet",
  "relative w-full",
  sheet ? "..." : "m-4 max-w-[420px]",
  settling && "transition-transform duration-300 ease-out",
)
```

> O `AchievementCelebration` já entra por cima (z-[120] > z-50), então a
> conquista pode disparar com o sheet ainda fechando sem conflito.

---

## 4) Transição ao trocar de página — `src/app/(app)/template.tsx` (novo)

Um `template.tsx` remonta a cada navegação → replay grátis da animação. Cobre
as trocas de aba (Início/Escalas/Cronograma/Equipes/Perfil).

```tsx
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
```

> Cuidado conhecido: `transform` no wrapper cria containing-block, o que
> afetaria `position: fixed`. Por isso `page-in` termina em `transform: none`
> (o header reativo volta ao normal ao fim dos 340ms) e o `Modal` já usa
> portal no `<body>`. Se notar o `ReactiveHeader` "pulando" na entrada, troque
> `page-in` por uma variante **só opacidade** (remova o `translateY`).
> A rota `notificacoes` mantém seu `template.tsx` próprio (`animate-push`).

Para escalonar a entrada dos cards da home (cascata), aplique `animate-fade-up`
com delays crescentes nos blocos de `volunteer-home.tsx` / `inicio/page.tsx`
(ex.: `style={{ animationDelay: "60ms" }}`), como no protótipo.

---

## 5) `src/components/app-shell/bottom-nav.tsx` — pill deslizante + pop no ícone

Mantém as 5 entradas do branch (líder/admin). A pílula dourada passa a
**deslizar** entre os itens e o ícone ativo dá um "pop". Substitua o corpo do
componente:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, ClipboardList, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EffectiveRole } from "@/lib/auth";

const base = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/escalas", label: "Escalas", icon: CalendarDays },
];

export function BottomNav({ role }: { role: EffectiveRole }) {
  const pathname = usePathname();

  const items = [
    ...base,
    { href: "/cronograma", label: "Cronograma", icon: ClipboardList },
    ...(role !== "volunteer" ? [{ href: "/equipes", label: "Equipes", icon: Users }] : []),
    { href: "/perfil", label: "Perfil", icon: User },
  ];

  const activeIdx = Math.max(
    0,
    items.findIndex((it) => pathname === it.href || pathname.startsWith(it.href + "/")),
  );
  const w = 100 / items.length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/85 backdrop-blur-lg pb-safe">
      <div className="relative mx-auto flex max-w-[520px] items-stretch justify-around px-2 pt-1.5 lg:max-w-[720px]">
        {/* pílula deslizante */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 h-8 rounded-full bg-accent/40 transition-[left] duration-300 ease-[cubic-bezier(.32,.72,.24,1)]"
          style={{ width: "3.5rem", left: `calc(${activeIdx * w}% + (${w}% - 3.5rem) / 2 + 0.5rem)` }}
        />
        {items.map(({ href, label, icon: Icon }, idx) => {
          const active = idx === activeIdx;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press-sm relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex h-8 w-14 items-center justify-center">
                <Icon
                  key={active ? "on" : "off"}
                  className={cn("size-5 transition-transform", active && "stroke-[2.3] nav-pop")}
                />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

> A posição `left` da pílula assume itens de largura igual (flex-1) com o
> padding `px-2` do container (`0.5rem`). Se ajustar o padding, ajuste o
> `+ 0.5rem` do cálculo. O `key={active ? ...}` remonta o ícone ativo → replay
> do `nav-pop` a cada troca.
>
> **Nav de 5 pro voluntário (opcional):** hoje o voluntário vê 4 (sem
> *Equipes*). Se quiser 5 fixos, adicione uma entrada de voluntário — natural
> seria *Disponibilidade* (`/disponibilidade`, ícone `CalendarCheck`) ou
> *Jornada* (`/jornada`, ícone `Trophy`): `...(role === "volunteer" ? [{ href:
> "/disponibilidade", label: "Datas", icon: CalendarCheck }] : [])`.

---

## Calibragem rápida (se ficar demais)

- Conquista: `confetti-fly` 1.15s → 0.8s; menos peças (16 → 10).
- Emoji: troque `anim-emoji` por só `spring-in` (sem overshoot de rotação).
- Página: `page-in` 0.34s → 0.22s, ou versão só-opacidade.
- Nav-pop: reduza o pico `scale(1.28)` → `1.14`.
