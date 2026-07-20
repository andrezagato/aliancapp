# Prompt pra colar no Claude Code (branch feat/fase-4)

Você está no repo do Sirvo (Next.js + Tailwind, tema "Aconchego"). Leia
`design_handoff_aconchego/ANIMACOES.md` — é a spec completa da camada de
animação, com código pronto por arquivo.

Aplique nesta ordem, testando o build (`npm run dev`) entre cada passo:

1. **Tokens de animação** — acrescente os `@keyframes` e utilitários ao
   `src/app/globals.css` (bloco "camada de animação 'tato'"), sem alterar o que
   já existe.
2. **Conquista** — substitua `src/components/achievement-celebration.tsx` pela
   versão com confete em leque + card com mola + emoji estourando.
3. **Modal** — aplique os diffs em `src/components/modal.tsx` pro sheet fechar
   com animação de saída (estado `closing` + `requestClose`).
4. **Transição de rota** — crie `src/app/(app)/template.tsx` com `.page-in`.
   Preserve o `template.tsx` da rota `notificacoes`. Se o `ReactiveHeader`
   pular na entrada, use a variante só-opacidade descrita na spec.
5. **Bottom-nav** — substitua `src/components/app-shell/bottom-nav.tsx` pela
   versão com pílula deslizante + `nav-pop` no ícone ativo. Mantenha as 5
   entradas do branch (Equipes só p/ líder/admin).

Regras:
- Não invente cores/tempos fora da spec; tudo deve honrar
  `prefers-reduced-motion` (o `globals.css` já zera durações).
- Não mexa em lógica de negócio (server actions, dados) — só apresentação e
  animação.
- Ao final, faça um resumo curto do que mudou por arquivo e aponte qualquer
  ponto que precise de calibragem (seção "Calibragem rápida" da spec).

Referência visual do resultado esperado: o protótipo `Sirvo Animado.dc.html`.
