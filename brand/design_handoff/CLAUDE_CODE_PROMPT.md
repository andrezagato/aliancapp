# Prompt para retomar no Claude Code

Copie o bloco abaixo e cole na sua sessão do Claude Code aberta na raiz do repo `servir/`.
Antes, arraste a pasta `design_handoff_aconchego/` para dentro do repo (ex.: `servir/design_handoff_aconchego/`).

---

```
Estou implementando um redesenho de UX chamado "Aconchego" no app de escalas Sirvo (este repo: Next.js 15 App Router + Tailwind + Supabase + Lucide).

A especificação completa está em ./design_handoff_aconchego/README.md — leia primeiro, por inteiro. Os arquivos SirvoApp.dc.html e Sirvo.dc.html nessa pasta são referências de design em HTML (protótipos de alta fidelidade), NÃO código para copiar. SirvoApp.dc.html contém toda a lógica de interação e é a fonte da verdade do comportamento.

Regras de implementação:
1. Recrie os designs usando o que JÁ existe no codebase: tokens de globals.css (bg-background, bg-primary, bg-accent, bg-success, bg-destructive, text-muted-foreground, border-border, shadow-soft, shadow-lift), font-display/font-sans, os utilitários .press/.press-sm, pb-safe/pt-safe, e os componentes em src/components/ui/.
2. NÃO hardcode os hex do protótipo — use a tabela de mapeamento de tokens no README (seção Design Tokens).
3. Ícones: apenas Lucide (convenção do repo). O README traz o mapeamento SVG→Lucide.
4. Prioridade número 1 é o "tato": press feedback, swipe-para-responder, pull-to-refresh, cabeçalho reativo à rolagem, push da direita para detalhe/notificações, bottom sheets com mola, e as transições de estado (pop + check desenhado) ao confirmar. Detalhes e valores no README (seção Interactions & Behavior).
5. Estado: a maior parte é server state (Supabase + server actions em lib/actions.ts) — aplique updates otimistas na UI. Só sheets/abas/push/progresso de gesto são estado client-side.
6. Respeite prefers-reduced-motion (o base layer já zera durações).

Comece propondo um plano de implementação por tela, na ordem: (1) tela Início do voluntário com o herói + swipe + pull-to-refresh + cabeçalho reativo, (2) detalhe do evento, (3) sheet de cancelar, (4) visão do líder + sheet de escalar, (5) admin, (6) abas Escalas/Pessoas/Disponibilidade/Perfil/Notificações. Não escreva código ainda — primeiro me mostre o plano e quais arquivos você vai tocar em cada passo.
```

---

## Notas
- Não consigo me comunicar diretamente com sua sessão do Claude Code, nem escrever na pasta `servir/` (só consigo lê-la). Por isso o handoff vem como pasta baixável/arrastável.
- Se preferir, aponte o Claude Code direto para este README: `Leia design_handoff_aconchego/README.md e implemente a tela Início do voluntário primeiro.`
- Os protótipos assumem viewport mobile (~390–402px). O app é PWA; teste em viewport de celular.
