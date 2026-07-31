# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

> PWA instalável (iOS + Android), mobile-first, fora das lojas. Next.js 15 App Router
> na Vercel. Não é app nativo e um wrapper nativo não está no plano.

## Users

Três perfis, todos com dor real e simultânea (confirmado pelo André em 27/07/2026 —
nenhum é secundário):

- **Voluntário** — membro que serve numa ou mais equipes. É a maioria das 28 pessoas
  ativas hoje. Chega por convite no e-mail, abre no celular, muitas vezes **sem prática
  com apps**, e precisa se virar sozinho. Job: descobrir onde e quando está escalado,
  confirmar ou cancelar (com motivo), avisar quando não pode, bater presença no dia.
- **Líder de equipe** — monta a escala da **própria** equipe, cobra confirmação e remenda
  cancelamento em cima da hora. **É o trabalho mais chato do produto.** Depois do culto,
  avalia (nota 1–5) e registra observação por pessoa.
- **Admin / produção** — cria eventos e séries, aprova quem entra, enxerga tudo. No
  **domingo usa ao vivo durante o culto**: roteiro rodando, presença, ajuste de última
  hora — em pé, com pressa, tela pequena.

A mesma pessoa pode ser **líder numa equipe e voluntário em outra**; o app resolve papel
efetivo por equipe, não um papel global só.

## Product Purpose

Sirvo escala **todas as equipes** de uma igreja (louvor, som, mídia, recepção, kids,
limpeza, produção…) e leva o ciclo **escalar → confirmar/cancelar** até o domingo:
disponibilidade prévia, troca de voluntário, motivo no cancelamento, presença no dia e
roteiro do culto ao vivo.

Sucesso é operacional, não vaidoso: **a igreja usa de verdade num culto real** — pessoas
cadastradas, escala do domingo montada, cada um confirmando pelo celular, presença batida
no dia. Isso já acontece (Beta 1 em produção desde 27/07/2026).

## Positioning

Substituto do **Timbragem Plan** (timbragemplan.com.br, 4.3★/57), que na prática é um app
de **ministério de louvor** (repertório/cifras) com escala como coadjuvante, e cujas
reclamações recorrentes são suporte inexistente e reset de senha quebrado.

O que um vizinho não copia de graça:

- **Escala é o produto**, não um apêndice do repertório — e vale para **toda** equipe da
  igreja, não só louvor.
- **Login sem senha** (Google) — mata exatamente o ponto onde o concorrente falha.
- **Compartimentação por escopo** nos avisos e no chat: líder de louvor não recebe barulho
  do som. Nunca broadcast.
- **Roteiro do culto ao vivo** (ordem do culto rodando no domingo, com contribuição de quem
  está escalado) colado na mesma escala.

## Operating Context

- **Uma igreja em produção: "Aliança"**, fuso `America/Sao_Paulo`, **7 equipes ativas**,
  **28 pessoas ativas**. Produção = `aliancapp.vercel.app`, branch `main`, tag `beta-1`.
- **O domingo é o palco.** O pico de uso é durante o culto: roteiro sendo tocado bloco a
  bloco, presença, remendo de última hora. Fora disso, o uso é assíncrono e curto (recebeu
  aviso → abre → confirma).
- **Onboarding é frio**: o voluntário conhece o app pelo e-mail de convite, sem ninguém do
  lado. Existe um tutorial próprio (`/primeiros-passos.html`) ligado ao convite, ao magic
  link e às telas de espera.
- **Duas portas de entrada**: convite do admin (entra direto) ou auto-cadastro (fila de
  aprovação). Erro de e-mail no convite cai na fila em vez de quebrar.
- **iOS limita Web Push a PWA instalada na tela inicial** (16.4+), sem prompt automático →
  **e-mail é o canal garantido no iPhone**; push é best-effort. Avisos críticos vão sempre
  por e-mail também.
- Ferramentas que orbitam o app hoje: WhatsApp (contato direto com voluntário), e-mail
  (Resend), pasta de arquivos externa por evento (link).

## Capabilities and Constraints

**Funcionando em produção:** escalar/confirmar/cancelar com motivo; disponibilidade;
troca/substituto; presença (conta na cobertura); cobertura por requisito de posição com
"não se aplica"; eventos avulsos e séries com template; calendário mensal navegável;
roteiro do culto ao vivo (dois níveis: estrutura por admin/produção, conteúdo por quem
está escalado); hub de equipes/posições/membros; convites e aprovações; histórico e "última
vez que serviu"; balanço do mês por equipe; jornada/conquistas do voluntário; avaliação do
culto pelo líder + observação por pessoa; chat interno compartimentado (Geral/Eventos/
Equipes); sino + Web Push (VAPID) + e-mail; aniversários.

**Restrições duráveis:**

- **Custo de infra R$ 0** é restrição de produto declarada, não preferência. Já derrubou
  opções (ex.: Supabase Storage descartado por egress).
- **Não é multi-tenant hoje**: o schema tem `church_id` em tudo, mas as policies de leitura
  são `using(true)` e `is_admin()` é global. A 2ª igreja exige reescrever RLS.
- Stack travada: Supabase (Postgres + Auth + Realtime + RLS) + Vercel + Resend + VAPID.
- Login **só Google**. Apple fora (exige conta paga + relay de e-mail no convite).
- Migrations versionadas em `supabase/migrations/` — banco em `0039`.
- **Vocabulário do domínio** (usar sempre estes termos): culto/evento, escala, escalar,
  equipe, posição, cobertura, roteiro, presença, disponibilidade, convite, aprovação.
- **Presença é auto-declarada** — a UI precisa deixar isso explícito, não fingir verificação.

**Decisões de produto em aberto (não inventar resposta):**

- **Multi-igreja**: confirmado como direção ("Aliança agora, outras igrejas em breve"), mas
  sem prazo, sem modelo de cobrança e sem onboarding de igreja nova definidos.
- **Assistente de escala** (solver determinístico × LLM × MCP conectado pelo próprio líder)
  — em exploração, nada iniciado.
- **Arquivos/galeria por evento** (R2 × YouTube não listado × só links embedados) — parado
  aguardando conversa com usuários.
- **Preferências de canal de notificação**: tabela `notification_prefs` existe e ainda **não
  é lida** pelo envio.

## Brand Commitments

- **Nome do produto: Sirvo.** É o nome no manifest e o que o usuário vê. `aliancapp` (repo)
  e `servir/` (pasta) são nomes legados de infraestrutura, não marca.
- **Modelo de marca: casca por igreja — logo, cor e tipografia** (confirmado em 28/07/2026,
  refinando a resposta inicial de "só logo e cor"). A igreja re-tinge o app e troca as
  fontes; **o esqueleto é do Sirvo e não se mexe**: layout, componentes, densidade,
  animação e vocabulário. Nas palavras do André: a arte atual foi feita inteiramente sobre a
  identidade da Aliança e, para outra igreja, "tudo pode e até deve ser diferente" — dentro
  desses dois eixos.
- **Consequência**: o tema atual (creme, vinho, dourado; Alegreya + Alegreya Sans; logos em
  `brand/`) é a **instância Aliança**, não a marca do produto. A identidade base do Sirvo,
  separada da igreja, **ainda não existe** — decisão em aberto.
- **Sensação obrigatória** (o que o produto tem de transmitir, confirmado pelo André):
  **servir é gratificante**. Convidativo, nunca burocrático; comunhão e diversão;
  gamificação **sem competição**; controle sem que o excesso de informação domine; passos
  curtos. O objetivo é dar vontade de abrir o app.
- Convenção declarada no repo (PLAN §9, README): **ícones Lucide/SVG, nunca emoji
  pictográfico na UI**; microcopy calorosa em pt-BR; rotas em português; estados vazios
  convidativos.
- Assets oficiais da Aliança: `brand/ALIANÇA_Logotipo-0{2,3,4}.svg`, `.eps`, `.pdf`,
  variações em PNG (creme, amarelo, marrom, preto, vinho), `brand/style-guide.html`.

## Evidence on Hand

- **Produto rodando com dados reais**: 28 pessoas ativas, 7 equipes, escalas e cultos reais
  em `aliancapp.vercel.app` (tag `beta-1`, 27/07/2026).
- **Assets de marca da Aliança** em `brand/` (logos vetoriais + style guide + handoffs de
  design em `brand/design_handoff*/`).
- **Tutorial de onboarding pronto e publicado**: `public/primeiros-passos.html`
  (fonte em `onboarding/`, pipeline `npm run demo:sync`).
- **Documentos de produto**: `PLAN.md` (fonte da verdade — visão, decisões travadas, modelo
  de dados, fases), `README.md`, `HANDOFF.md`, `CHECKLIST-VALIDACAO.md`, `SESSAO-*.md`.
- **Não existe** (e não pode ser fabricado): pesquisa formal com usuários, métrica de
  adoção ou de entrega de aviso, depoimento, estudo de caso, benchmark contra o
  concorrente, preço, página de venda, política de privacidade pública.

## Product Principles

1. **Escalar → confirmar é o eixo.** Toda função nova orbita esse ciclo ou justifica por que
   existe fora dele.
2. **Compartimentar é a joia.** Cada aviso vai só a quem tem escopo naquela equipe, evento
   ou pessoa. Broadcast é bug, não atalho — e a garantia é código, então precisa de teste.
3. **O sistema sugere, o humano decide.** Vale para escala assistida, presença e qualquer
   automação futura: nada entra na escala sem alguém confirmar.
4. **Menos telas, menos carregamentos.** Preferir modal/bottom-sheet a navegar pra página
   nova — o voluntário está no 4G da igreja, com pressa.
5. **Custo zero de infra é requisito.** Uma função que só fecha com egress caro não fecha.

## Accessibility & Inclusion

Nenhuma necessidade específica de acessibilidade foi observada nos voluntários reais até
27/07/2026 (confirmado pelo André) — não há requisito de produto estabelecido além da boa
prática normal: alvos de toque confortáveis, contraste legível, foco visível (já
implementado em `globals.css`) e o app inteiro utilizável com o polegar.
