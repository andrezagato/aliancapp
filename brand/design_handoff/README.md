# Handoff: Sirvo — redesenho "Aconchego" da experiência (voluntário · líder · admin)

## Overview
Redesenho de UX do app de escalas **Sirvo** (repo `servir/` — Next.js 15 App Router + Tailwind + Supabase + Lucide). O foco do trabalho foi a **usabilidade e o "tato"**: o app não precisa de mais recursos que o concorrente (Timbragem), precisa fazer o essencial com uma experiência calorosa e responsiva. A direção visual aprovada chama-se **Aconchego**.

O fluxo central é **receber a escala → confirmar/recusar num toque → check-in no dia**, mais as visões de **líder** (montar escala) e **admin** (gerir a igreja).

## About the Design Files
Os arquivos `Sirvo.dc.html` e `SirvoApp.dc.html` neste bundle são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos. **Não são código de produção para copiar.** A tarefa é **recriar esses designs dentro do codebase existente** (`servir/`), usando os padrões já estabelecidos: React Server/Client Components, Tailwind com os tokens de `globals.css`, componentes de `src/components/ui/`, ícones Lucide, e as server actions em `lib/actions.ts`.

`SirvoApp.dc.html` é a fonte da verdade do comportamento (contém toda a lógica de estado/interação). `Sirvo.dc.html` só é o palco que monta os três papéis lado a lado.

## Fidelity
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios e microinterações são finais. Recrie a UI fielmente usando o design system do codebase. Onde eu hardcodei hex no protótipo (porque o HTML não tinha os tokens), **use os tokens Tailwind/CSS equivalentes** — o mapa está na seção *Design Tokens*.

---

## Screens / Views

Todas as telas vivem na área logada `src/app/(app)/` com o `AppShell` (top bar + bottom nav role-aware). Larguras pensadas para mobile PWA (~390–402px de viewport útil).

### 1. Início (`/inicio`) — por papel

**Voluntário**
- **Hoje (se houver escala no dia):** card âmbar (gradiente `--accent`) com pill "É HOJE", nome do evento, equipe·função e botão **Fazer check-in** (vinho). Depois do check-in vira faixa verde "Presente · HH:MMh" com check animado.
- **Herói — "Sua próxima escala":** card vinho (gradiente `#7A1327→#55101E` = `--primary`) com brilho dourado pulsando no canto. Título grande em serif, data por extenso, pills de equipe/função. Ações: **Confirmar** (botão dourado) + **Não posso** (contorno claro). Ao confirmar/recusar, colapsa para uma faixa de estado com "Ver escala ›".
- **Lista "Suas escalas":** cards creme (`--card`) com bloco de data à esquerda (dia grande em vinho), evento, equipe·função (com dot da cor da equipe) e badge de status. **Swipe:** arrastar → revela ação verde "Confirmar"; arrastar ← revela vermelho "Não posso" (abre sheet).

**Líder**
- **3 stat tiles:** Vagas abertas / Aguardando / Interesses.
- **Herói "Próximo culto":** card vinho com **anel de cobertura** (conic-gradient dourado) mostrando confirmados/total no centro + botão **Abrir escala**.
- **"Precisam de escala":** linha clicável com ícone de alerta e badge "N vagas" → abre a escala.

**Admin**
- **3 stat tiles:** Aprovações / Eventos / Sem escala.
- **Ações:** **Criar evento** (vinho) + **Convidar** (contorno).
- **Herói "Próximo culto"** com pills de cobertura por equipe (verde/âmbar/vermelho conforme staffing).
- **"Aguardando aprovação":** linhas com avatar, nome, email, botão **Aprovar** (verde) e **✕** recusar. Empty-state verde "Tudo em dia".

### 2. Detalhe do evento (push da direita, `/escalas/[id]`)
- Header vinho com kicker, título, hora e local (ícones Lucide clock/pin).
- **Voluntário:** card da sua equipe com badge de cobertura; "Sua função · X"; sua linha (avatar dourado + "(você)") com badge de status; ações Confirmar/Não posso, ou check-in se for hoje, ou aviso vermelho se recusou. Abaixo: pills "Como está o evento" (cobertura das outras equipes).
- **Líder:** card da equipe com cobertura total; lista de **posições** (Vocal, Guitarra, Bateria, Teclado) — cada uma com contador X/Y, pessoas preenchidas (avatar, nome, badge Confirmado/Aguardando, botão ✕ remover) e um botão tracejado **"Escalar {posição}"** com contagem de vagas → abre o sheet de escalar.

### 3. Escalas (aba, `/escalas`)
- **Voluntário:** lista mensal simples de todas as suas escalas (card com data + status), clicável para o detalhe.
- **Líder/Admin:** lista de eventos próximos; cada card mostra título, data e pills de cobertura por equipe; toque abre a gestão da escala.

### 4. Pessoas (aba, `/pessoas` — líder/admin)
- Admin: botão **Convidar pessoa** + bloco "Pendentes de aprovação" (Aprovar/✕).
- Diretório "Toda a igreja" (admin) / "Minha equipe" (líder): linhas com avatar, nome, equipes, badge "Líder".

### 5. Disponibilidade / "Livre?" (aba, `/disponibilidade` — voluntário)
- Card âmbar explicativo "Quando você não pode".
- **Calendário mensal** (grid 7 colunas): dias tocáveis alternam livre (creme) ↔ bloqueado (vermelho `--destructive`). Contador "N dias bloqueados". Legenda. Botão **Salvar disponibilidade**.

### 6. Perfil (aba, `/perfil`)
- Header vinho com avatar grande, nome (serif), papel e pills de equipes.
- Lista de linhas: Minhas equipes, Notificações, Disponibilidade (só voluntário), Tema, Ajuda, **Sair** (vermelho). Cada uma com ícone tintado e chevron.

### 7. Notificações (push da direita, `/notificacoes`) — acionado pelo sino da top bar
- Lista de cards: escalação, confirmação de colega, aniversário, alerta de vaga. Não-lidas têm fundo card + dot dourado; lidas têm fundo creme.

### Sheets (bottom sheets, sobem com mola)
- **Cancelar:** "Não vai poder?" + chips de motivo (Viajando/Trabalho/Saúde/Compromisso/Outro) + linha "Sugerir substituto (opcional)" + CTA vermelho (habilita só com motivo escolhido).
- **Escalar:** lista de candidatos com avatar, nome e "última vez que serviu"; indisponíveis ficam esmaecidos com pill "Indisponível"; já escalados mostram "Já na escala"; os demais têm botão **+** (convidar).
- **Criar culto:** toggle Avulso/Série, campos Título/Data/Hora/Local, CTA "Criar culto".

---

## Interactions & Behavior (o "tato" — prioridade máxima)
- **Press feedback:** todo elemento tocável afunda levemente (`scale(.92–.99)`) no `pointerdown` e volta no `pointerup/leave`. O codebase já tem `.press` e `.press-sm` em `globals.css` — **use-os** em vez de reimplementar.
- **Swipe nos cards de escala (home do voluntário):** arrasto horizontal; após ~88px confirma (direita) ou abre sheet de cancelar (esquerda); a ação de fundo (verde/vermelho) aumenta de opacidade conforme o arrasto. Discrimina swipe × scroll pela dominância do eixo. Cards já resolvidos limitam o arrasto à direita.
- **Pull-to-refresh:** puxar no topo revela a "chama" (ícone Lucide `flame`) que gira conforme a distância; solta > ~48px dispara refresh (spinner → "Tudo em dia" → recolhe).
- **Cabeçalho reativo à rolagem:** título grande encolhe/desaparece, um título condensado central aparece, e um fundo com blur/borda ganha opacidade (crossfade entre 0–70px de scroll).
- **Transições de tela:** detalhe do evento e notificações entram como **push da direita** (`translateX` 100%→0, `.34s cubic-bezier(.32,.72,.24,1)`). Sheets sobem (`translateY(102%)→0`) com scrim que faz fade.
- **Transições de estado:** confirmar dispara um "pop" (`scale` 1→1.045→1) + check que se desenha (`stroke-dashoffset`). Toasts sobem embaixo, ficam ~2.6s e sobem sumindo.
- **Bottom nav:** troca de aba reseta o scroll ao topo; pill dourada sob o item ativo.

## State Management
No codebase real, a maior parte é **server state** (Supabase + server actions), não estado local. O protótipo simula tudo em memória; mapeie assim:

- **Escalas do usuário** → `lib/data.ts` (leitura) + `assignment-response.tsx` chamando `lib/actions.ts` (`confirmar`/`recusar`).
- **Confirmar/Recusar/Check-in** → server actions existentes; otimista na UI (aplica o novo status na hora, com o "pop"), reconcilia com o retorno.
- **Escalar / remover da posição** → `lib/actions.ts` (escalar) + `leader-controls.tsx`/`slot-controls.tsx`.
- **Aprovar/Recusar entrada** → server actions de convites/aprovações; `people-controls.tsx`.
- **Disponibilidade** → `disponibilidade-manager.tsx` (Fase 2); estado local do calendário + persist na action de salvar.
- **UI local (efêmero):** sheet aberto (cancelar/escalar/criar), motivo selecionado, aba ativa, push aberto (evento/notificações), progresso de swipe/pull. Tudo client-side.

Papel efetivo (voluntário/líder/admin) vem de `lib/auth.ts` (`getSession`) — a home, o bottom nav e as abas já são role-aware no codebase.

## Design Tokens
**Não hardcode os hex do protótipo.** Eles mapeiam 1:1 nos tokens que já existem em `src/app/globals.css` / `tailwind.config.ts`:

| Papel no design | Hex no protótipo | Token existente | Utilitário Tailwind |
|---|---|---|---|
| Base creme | `#FBF6E9` | `--background` (44 56% 95%) | `bg-background` |
| Card | `#FFFDF8` | `--card` (48 60% 98%) | `bg-card` |
| Texto (tinta) | `#3A2A28` | `--foreground` (8 20% 18%) | `text-foreground` |
| Texto suave | `#8A7A6B`/`#9a8b7c` | `--muted-foreground` (27 13% 40%) | `text-muted-foreground` |
| Vinho (ação/sagrado) | `#6E1122`/`#55101E`/`#7A1327` | `--primary` (349 70% 26%) | `bg-primary`/`text-primary` |
| Dourado (ênfase/"chama") | `#E7B84E`/`#F1D278` | `--accent` (42 78% 60%) | `bg-accent`/`text-accent` |
| Verde (sucesso/confirmado) | `#3F7D52` | `--success` (138 34% 37%) | `bg-success` |
| Vermelho (recusar/vaga) | `#C0392B` | `--destructive` (6 62% 46%) | `bg-destructive` |
| Azul (equipe mídia) | `#6E97D6` | `--info` (217 54% 63%) | via `hsl(var(--info))` |
| Borda | `#EADFC7` | `--border` (40 40% 85%) | `border-border` |

- **Raio:** `--radius: 1rem` (`rounded-lg`); cards grandes do protótipo usam ~20–26px → `rounded-2xl`/`rounded-3xl` são aceitáveis para heróis.
- **Sombras:** use `shadow-soft` (cards) e `shadow-lift` (heróis/elevados) — já definidas.
- **Tipografia:** `font-display` = Alegreya (títulos/números), `font-sans` = Alegreya Sans (interface). Títulos já recebem `tracking-tight` + `text-wrap: balance` no base layer.
- **Animação:** `animate-fade-in` já existe; adicione keyframes para `pop`, `draw` (check), `sheet`, `scrim`, `toast`, `glow` no `tailwind.config.ts` (valores no protótipo). Respeite `prefers-reduced-motion` (o base já zera durações).
- **PWA/safe-area:** use `pb-safe`/`pt-safe` (já existem) no bottom nav e headers.

## Assets
- Ícones: **apenas Lucide** (convenção do repo — nada de emoji). Mapeamento dos SVGs inline do protótipo para Lucide: `Bell`, `Clock`, `MapPin`, `Check`, `CheckCheck`, `X`, `Plus`, `Flame` (pull-to-refresh), `AlertTriangle`, `Users`/`UserPlus`, `CalendarDays`, `Home`, `CircleUser`, `Moon`, `HelpCircle`, `LogOut`, `ChevronLeft`/`ChevronRight`.
- Logos da marca: `servir/brand/creme_logo.png`, `vinho_logo.png` (usados no palco do protótipo).
- Nenhuma imagem gerada; tudo é cor + tipografia + ícone.

## Files
Neste bundle:
- `SirvoApp.dc.html` — protótipo completo (3 papéis, todas as telas, toda a lógica de interação). **Referência principal.**
- `Sirvo.dc.html` — palco que monta os três telefones lado a lado (só apresentação).
- `CLAUDE_CODE_PROMPT.md` — prompt pronto para colar no Claude Code e retomar o trabalho.

No codebase (`servir/`), os pontos de recriação:
- Telas: `src/app/(app)/{inicio,escalas,escalas/[id],pessoas,disponibilidade,perfil,notificacoes}/`
- Shell: `src/components/app-shell/{top-bar,bottom-nav}.tsx`
- Componentes de ação: `assignment-response.tsx`, `leader-controls.tsx`, `slot-controls.tsx`, `people-controls.tsx`, `disponibilidade-manager.tsx`, `coverage-badge.tsx`, `modal.tsx`, `empty-state.tsx`
- Primitivos: `src/components/ui/{button,card,badge,avatar}.tsx`
- Dados/ações: `lib/data.ts`, `lib/actions.ts`, `lib/auth.ts`, `lib/coverage.ts`, `lib/format.ts`
- Tema: `src/app/globals.css`, `tailwind.config.ts`

## Como abrir os protótipos
Os `.dc.html` são "Design Components". Para ver no navegador é preciso o runtime que acompanha o export; o mais simples é **ver os screenshots** (se incluídos) ou ler o HTML como especificação — a estrutura, os estilos inline e a classe de lógica são legíveis e completos. Se quiser rodar interativo, abra na mesma ferramenta em que foram criados.
