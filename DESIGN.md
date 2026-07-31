---
name: Sirvo — instância Aliança
description: Escalas de igreja em creme e vinho, com a chama dourada só onde vale celebrar.
colors:
  vinho: "hsl(349 70% 26%)"
  vinho-foco: "hsl(349 70% 32%)"
  vinho-hero-de: "hsl(349 72% 28%)"
  vinho-hero-ate: "hsl(349 69% 15%)"
  dourado: "hsl(42 78% 60%)"
  creme: "hsl(44 56% 95%)"
  creme-carta: "hsl(48 60% 98%)"
  creme-claro: "hsl(36 78% 95%)"
  marrom-cacau: "hsl(32 70% 16%)"
  grafite-quente: "hsl(8 20% 18%)"
  areia: "hsl(43 46% 89%)"
  pedra: "hsl(27 13% 40%)"
  linha: "hsl(40 40% 85%)"
  musgo: "hsl(138 34% 37%)"
  musgo-tinta: "hsl(138 34% 33%)"
  ambar: "hsl(36 62% 47%)"
  ambar-tinta: "hsl(36 62% 33%)"
  telha: "hsl(6 62% 46%)"
  telha-tinta: "hsl(6 62% 44%)"
  azul-manso: "hsl(217 54% 63%)"
  branco: "hsl(0 0% 100%)"
  atmosfera-ambar: "hsl(45 80% 88% / 0.55)"
  atmosfera-terracota: "hsl(6 40% 88% / 0.4)"
  cat-terracota: "#C4633E"
  cat-oliva: "#5B6B4E"
  cat-azul-fundo: "#4E86A6"
  cat-ameixa: "#7C6BAF"
  cat-dourado-barro: "#B0894A"
  cat-verde-garrafa: "#3F6F5B"
  cat-framboesa: "#9C4A6B"
  cat-cacau: "#8C5B3F"
  cat-turquesa-fosca: "#3E7F86"
  cat-ardosia: "#5F6D8C"
typography:
  display:
    fontFamily: "Alegreya, Georgia, serif"
    fontSize: "29px"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Alegreya, Georgia, serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Alegreya, Georgia, serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Alegreya Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "ss01, cv01"
  micro:
    fontFamily: "Alegreya Sans, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Alegreya Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.14em"
rounded:
  foco: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  hero: "22px"
  sheet: "26px"
  pill: "999px"
spacing:
  inline: "10px"
  stack: "12px"
  card: "16px"
  gutter: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.vinho}"
    textColor: "{colors.creme-claro}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-accent:
    backgroundColor: "{colors.dourado}"
    textColor: "{colors.marrom-cacau}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.creme-carta}"
    textColor: "{colors.grafite-quente}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.telha}"
    textColor: "{colors.branco}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  card:
    backgroundColor: "{colors.creme-carta}"
    textColor: "{colors.grafite-quente}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  input:
    backgroundColor: "{colors.creme-carta}"
    textColor: "{colors.grafite-quente}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  badge-neutral:
    backgroundColor: "{colors.areia}"
    textColor: "{colors.pedra}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-success:
    backgroundColor: "hsl(138 34% 37% / 0.12)"
    textColor: "{colors.musgo}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-warning:
    backgroundColor: "hsl(36 62% 47% / 0.15)"
    textColor: "{colors.ambar}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-danger:
    backgroundColor: "hsl(6 62% 46% / 0.12)"
    textColor: "{colors.telha}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  hero-wine:
    backgroundColor: "{colors.vinho}"
    textColor: "{colors.creme-claro}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.gutter}"
  nav-pill:
    backgroundColor: "hsl(42 78% 60% / 0.4)"
    rounded: "20px"
    width: "64px"
---

# Design System: Sirvo — instância Aliança

## Overview

**Creative North Star: "A Festa de Bastidor"**

Servir é trabalho invisível: alguém chegou às 7h pra ligar a mesa de som, alguém trocou o
domingo de folga. Este sistema existe pra tornar esse bastidor visível e gostoso. O
movimento central não é "preencher a escala", é **ser convidado e dizer sim** — e o sim é
celebrado: o botão dourado incha de leve, o check se desenha, o confete voa. Nada aqui pode
parecer um formulário que te cobra.

A matéria é **papel macio empilhado**. Tudo é creme sobre creme, separado por sombras
difusas e largas e uma linha quente quando precisa — nunca por contorno duro ou cinza
neutro. Por cima desse papel, um único bloco por tela vira **vinho profundo**: é onde mora o
que importa agora (a sua próxima escala, o seu perfil, a sua jornada). Nesse bloco, e só
nele, uma chama dourada pulsa no canto. O resto da tela respira em creme.

Densidade é uma decisão de produto, não de estética: o líder precisa de **controle sem que o
excesso de informação domine**. Por isso cada card entrega o estado num relance — um anel,
uma fração, uma pílula colorida — e guarda o detalhe atrás de um toque. Passos curtos: quase
nada navega pra página nova, tudo abre em bottom sheet com alça. E gamificação existe
(conquistas, sequência, meses servindo) **sem competição**: os números falam de pertencer,
nunca de estar na frente de alguém.

Esta é a **instância Aliança**: cor e tipografia vêm da identidade da igreja e são a camada
trocável — outra igreja re-tinge e troca as fontes, e deve mesmo ficar diferente. O que **não**
se mexe é o esqueleto: coluna única, cinco abas, papel empilhado, pílulas, sheet com alça,
celebração no sim, vocabulário de escala.

**Key Characteristics:**
- Creme como estado natural; vinho como acontecimento; dourado como recompensa.
- Serifa (Alegreya) nomeia coisas; sans (Alegreya Sans) explica coisas.
- Coluna única de 520px, cinco abas fixas, ação sempre no alcance do polegar.
- Zero quina viva: 8px no mínimo, 16px no padrão, pílula em tudo que se toca e é curto.
- Movimento com mola, nunca com salto — e desligado inteiro em `prefers-reduced-motion`.
- Estado sempre legível em um relance, antes de qualquer leitura.
- Ícones Lucide em traço; a única exceção viva no código é `/jornada`.

## Colors

Uma paleta de casa antiga: creme de parede, vinho de veludo, dourado de chama, e três cores
de estado que só falam de escala.

### Primary
- **Vinho de Veludo** (`{colors.vinho}`): a cor do que importa agora. Carrega o herói do topo
  (em degradê pro vinho quase-preto), o botão primário, o número do dia no card de evento, o
  anel de foco. É a cor da igreja, não um azul de ferramenta.
- **Vinho de Foco** (`{colors.vinho-foco}`): dois pontos mais claro, exclusivo do anel de
  foco visível — precisa vencer o fundo creme e o fundo vinho.

### Secondary
- **Dourado de Chama** (`{colors.dourado}`): a recompensa. Kicker caixa-alta do herói, botão
  "Confirmar", pílula da aba ativa (a 40%), brilho pulsante no canto do herói, avatar sem
  foto (a 25%). Nunca preenche área grande — é chama, não tinta.
- **Marrom Cacau** (`{colors.marrom-cacau}`): o texto que vai sobre dourado. Escuro o
  suficiente pra ler em botão cheio.

### Neutral
- **Creme de Parede** (`{colors.creme}`): o fundo do app. Recebe dois radiais fixos quentes
  que dão calor nas quinas sem virar textura — e que são parte do sistema, não enfeite de
  uma tela:

  ```css
  background-image:
    radial-gradient(60rem 30rem at 85% -8%, hsl(45 80% 88% / 0.55), transparent 60%),
    radial-gradient(48rem 26rem at -10% 108%, hsl(6 40% 88% / 0.4), transparent 55%);
  background-attachment: fixed;
  ```

  Âmbar no topo-direito (`{colors.atmosfera-ambar}`), terracota no rodapé-esquerdo
  (`{colors.atmosfera-terracota}`), `fixed` para não deslizar com o scroll. São as duas
  únicas cores que existem só como atmosfera — nunca como superfície, borda ou texto.
- **Creme de Carta** (`{colors.creme-carta}`): a superfície dos cards. Mais claro que o
  fundo, é o que faz o papel empilhado funcionar sem precisar de borda.
- **Creme Claro** (`{colors.creme-claro}`): o texto sobre vinho. Nos títulos dentro do herói,
  branco puro; no corpo, este creme a 85% de opacidade.
- **Grafite Quente** (`{colors.grafite-quente}`): o texto. Marrom-grafite, não preto — preto
  puro brigaria com o creme. Também é o fundo do toast e o véu do sheet (a 42%).
- **Areia** (`{colors.areia}`): superfície secundária — chip neutro, quadradinho da data,
  fatia vazia do anel de cobertura.
- **Pedra** (`{colors.pedra}`): texto secundário, rótulo de aba inativa, legenda.
- **Linha Quente** (`{colors.linha}`): borda e campo. Creme escurecido, com hue, nunca cinza.

### Tertiary
- **Musgo** (`{colors.musgo}`): cobertura completa, presença confirmada, o check do toast.
- **Âmbar de Barro** (`{colors.ambar}`): cobertura parcial — a fatia do anel cônico.
- **Telha** (`{colors.telha}`): vaga aberta, cancelamento, exclusão.
- **Azul Manso** (`{colors.azul-manso}`): apoio informativo. É a única cor fria do sistema e
  aparece muito pouco — se um azul começar a dominar uma tela, algo saiu do mundo.

**Cada cor de estado tem duas faces: a cor e a tinta.** O padrão antigo do chip — texto na
cor sobre **a mesma cor a 12–15%** (`bg-success/12 text-success`) — não alcançava o mínimo AA
de 4,5:1 em **nenhum** dos três estados: o tinte escurece o creme e come exatamente o
contraste de que o texto precisava. Medido a 12px sobre creme de parede:

| Estado | Como texto na cor cheia | Tinta (o que o texto usa) |
|---|---|---|
| Musgo `hsl(138 34% 37%)` | 3,86:1 ✗ | L **33%** → 4,63:1 ✓ |
| Âmbar `hsl(36 62% 47%)` | 2,48:1 ✗ | L **33%** → 4,56:1 ✓ |
| Telha `hsl(6 62% 46%)` | 4,23:1 ✗ | L **44%** → 4,54:1 ✓ |
| Vinho `hsl(349 70% 26%)` | 8,49:1 ✓ | não precisa |

A correção mantém o tinte na cor cheia — preenchimento, bola e fatia do anel cônico não
mudaram nada — e escurece **só o texto**: `--success-ink`, `--warning-ink`,
`--destructive-ink` em `globals.css`, expostos no Tailwind como `text-success-ink` e irmãos.
No miolo do anel parcial (texto sobre creme de carta sólido, `event-pies-card.tsx`) o âmbar
saiu de 3,01:1 pra a mesma tinta. **Regra prática: `bg-*/12` para o tinte, `text-*-ink` para
o texto — `text-success` cru não vai em texto nenhum.** No escuro a tinta inverte o sentido
(clareia); os valores existem, dormentes, no bloco `.dark`.

### Categoria (equipe e bloco de roteiro)

Duas coisas no app têm cor **livre**, escolhida por gente e guardada no banco: a equipe (o
pontinho que aparece no card, na escala, no chat) e o tipo de bloco do roteiro. Elas não
podem sair da trinca de estado — musgo/âmbar/telha já significam cheio/parcial/vazio — nem
de um cinza de biblioteca. Então têm paleta própria: **10 tons abafados** (`cat-*` no
frontmatter, `src/lib/palette.ts` no código, hexadecimal porque vivem no banco):

| | | |
|---|---|---|
| Terracota `#C4633E` | Oliva `#5B6B4E` | Azul de Fundo `#4E86A6` |
| Ameixa `#7C6BAF` | Dourado de Barro `#B0894A` | Verde-Garrafa `#3F6F5B` |
| Framboesa `#9C4A6B` | Cacau `#8C5B3F` | Turquesa Fosca `#3E7F86` |
| Ardósia `#5F6D8C` | *neutro:* Pedra `#736459` | |

As matizes abrem de 17° a 336° pra que dois pontinhos vizinhos nunca se confundam, e a
saturação fica presa entre 16% e 53% pra que nenhuma delas grite mais alto que o vinho.
Categoria sem cor definida usa **Pedra** — o mesmo tom do texto secundário.

**Cor nova nasce do próximo tom livre**, nunca de um default fixo: `nextCategoryColor()`
olha o que a igreja já usa e entrega o tom menos repetido. O default fixo antigo é o motivo
de 4 das 8 equipes da Aliança terem nascido com o mesmo pontinho verde — e um ponto repetido
não diz "essa é a sua equipe", não diz nada.

**Modo escuro está definido, mas dorme.** `globals.css` traz um bloco `.dark` completo
(vinho clareia para `hsl(349 55% 55%)`, fundo vira `hsl(350 18% 9%)`) e o Tailwind está em
`darkMode: ["class"]` — mas nada no app aplica a classe `.dark` e nenhum componente usa
variante `dark:`. Tratar como paleta reservada, não como recurso existente: quem ligar o modo
escuro terá de revisar contraste e as sombras marrons, que só funcionam sobre creme.

### Named Rules

**A Regra do Vinho Raro.** No máximo **um** bloco vinho por tela. O vinho não é fundo, é
acontecimento: quando dois blocos disputam, nenhum é importante.

**A Regra da Chama Pontual.** O dourado marca só o que se toca ou se celebra. Se ele estiver
cobrindo mais de uns 10% da tela, virou tinta e perdeu a função.

**A Regra do Semáforo Fechado.** Musgo, âmbar e telha são vocabulário de **estado de escala**
(cheio / parcial / vazio) e de nada mais. Não os use como cor decorativa, nem para categorias
que não sejam cobertura, presença ou risco.

**A Regra da Borda Quente.** Nenhum cinza neutro no sistema. Toda borda, divisor e campo sai
de `{colors.linha}` — creme escurecido com matiz. Cinza puro lê como planilha.

**A Regra da Cor Própria.** Categoria (equipe, bloco de roteiro) não empresta cor de estado
nem de biblioteca: sai da Paleta de Categoria, e cada uma nasce com um tom que ninguém está
usando. Um vermelho de biblioteca no roteiro e um verde de "confirmado" numa equipe são a
mesma falha — cor dizendo o que não é.

## Typography

**Display Font:** Alegreya (fallback Georgia, serif) — pesos 500 / 700 / 800
**Body Font:** Alegreya Sans (fallback system-ui) — pesos 400 / 500 / 700

**Character:** Uma família só, em dois temperamentos. A serifa da Alegreya tem origem
literária e humanista: dá nome próprio ao que ela toca — o título do culto, o nome da pessoa,
o número do dia. A Alegreya Sans é a mesma voz falando baixo, pra tudo que é informação
corrida. Porque são irmãs, o app nunca soa como dois produtos colados; e como a serifa é
quente, ela celebra sem ficar cerimoniosa. O corpo roda com `font-feature-settings:
"ss01", "cv01"` ligados.

### Hierarchy
- **Display** (800, 26–29px, 1.04): título dentro do herói vinho — "Sua próxima escala",
  o nome do culto, "A caminhada de Ana". O maior tipo do app, e sempre sobre vinho.
- **Headline** (800, 23px, 1.05, tracking apertado): título de página no cabeçalho reativo.
  Encolhe e desaparece na rolagem, cedendo lugar a um condensado central de 17px bold.
- **Title** (700–800, 17px, 1.15): nome de evento no card, título do sheet (22px),
  cabeçalho de seção. Sempre serifa. O `CardTitle` genérico usava `text-lg` (18px) por
  acidente e convergiu pro passo do sistema.
- **Body** (400, 14px, 1.5): todo texto corrido, sans.
- **Micro** (500, 12.5px, 1.4): o passo abaixo do corpo — legenda de card, nome do
  responsável, chip, hora. É um degrau real e muito usado, não um arredondamento.
  Abaixo de 11px nada é texto, só rótulo.
- **Label** (800, 11px, caixa-alta, tracking 0.14em): o kicker dourado do herói e os rótulos
  de aba (12px semibold, sem caixa-alta).

### Named Rules

**A Regra da Serifa que Nomeia.** Alegreya só onde algo tem nome próprio: título, pessoa,
dia, número que identifica. Informação corrida, rótulo e ajuda são sempre Alegreya Sans.
Serifa em parágrafo é ruído; sans em nome de culto é frieza.

**A Regra do Kicker Dourado.** O rótulo 11px extrabold caixa-alta com tracking 0.14em em
dourado é a assinatura do bloco vinho. Ele não existe sobre creme — fora do herói, rótulo é
`{colors.pedra}` em caixa normal.

**A Regra do Número que Não Dança.** Toda fração, contagem e hora usa `tabular-nums`. Um
"3/6" que muda de largura ao atualizar destrói a sensação de coisa sólida.

## Layout

**Coluna única, sempre.** Um contêiner de `max-width: 520px` no celular e `720px` a partir de
`lg`, centralizado, com goteira de 20px. Não existe layout de duas colunas em nenhuma tela:
o app foi desenhado pro polegar, e o desktop é o mesmo app mais largo.

**Ritmo vertical.** Cards empilham com 12px entre si; o padding interno padrão é 16px; seções
respiram 24px. A página inteira entra com um fade de 340ms (`page-in`, só opacidade — um
translate criaria containing block e faria o cabeçalho fixo pular).

**Estrutura de tela.** Cabeçalho reativo no topo (título grande que encolhe na rolagem, fundo
blur que ganha opacidade, campainha + avatar à direita), conteúdo em pilha, e **cinco abas
fixas** no rodapé — Início, Escalas, Roteiro, Equipes, Perfil — sobre `bg-card/85` com
`backdrop-blur-lg`. Ambas as barras respeitam as faixas de segurança (`pt-safe`, `pb-safe`)
porque o app roda instalado, com notch.

**Densidade.** Confortável, não densa. Cada linha de lista tem alvo de toque de 40px ou mais;
o estado vem primeiro em forma de anel, fração ou pílula, e o detalhe fica atrás de um toque.

### Named Rules

**A Regra do Relance.** Todo card responde à pergunta "está de pé ou não?" antes de qualquer
leitura — pelo anel, pela pílula, pela cor. Se for preciso ler uma frase pra saber o estado,
o card falhou.

**A Regra do Sheet em Vez de Página.** Ação secundária abre em bottom sheet com alça, não em
rota nova. Menos carregamento no 4G da igreja, e o contexto de onde a pessoa estava não se
perde.

## Elevation & Depth

Papel macio empilhado. O sistema tem exatamente **duas** sombras, ambas difusas, largas e
tingidas de marrom (`rgba(43, 39, 36, …)`) — nunca preto puro, que sujaria o creme.
Profundidade vem de três coisas somadas: a diferença de luminosidade entre o fundo creme e o
card creme-carta, a sombra ambiente, e a linha quente. Nada de borda escura para "criar
volume".

### Shadow Vocabulary
- **soft** (`0 1px 2px rgba(43,39,36,.04), 0 8px 24px rgba(43,39,36,.06)`): repouso. Todo
  card, todo botão cheio.
- **lift** (`0 2px 4px rgba(43,39,36,.05), 0 14px 40px rgba(43,39,36,.10)`): o que flutua ou
  reage — herói vinho, hover do botão, toast.
- **sheet** (`0 -12px 40px rgba(58,42,40,.2)`): exclusiva do bottom sheet, projetada pra
  cima, porque a luz vem de cima e o sheet sobe contra ela.
- **glow dourado** (`0 8px 20px rgba(231,184,78,.32)`): só embaixo do botão "Confirmar".
  A única sombra colorida do sistema, e o que faz o sim parecer quente.

### Named Rules

**A Regra das Duas Sombras.** `soft` em repouso, `lift` no que flutua. Uma terceira sombra
inventada quebra o empilhamento — se algo precisa se destacar mais, mude de superfície ou de
cor, não de sombra.

**A Regra da Sombra Marrom.** Sombra preta sobre creme lê como sujeira. Toda sombra do
sistema é marrom translúcido.

## Shapes

Nenhuma quina viva. O raio é escalonado por tamanho e por intimidade: quanto mais perto do
dedo e mais curto o elemento, mais redondo.

- **Pílula (999px)** — tudo que se toca e é curto: botão, badge, chip, avatar, pontinho de
  equipe, alça do sheet, anel de cobertura. É a forma dominante do app.
- **16px (`{rounded.lg}`, o `--radius`)** — a superfície padrão: card, campo, painel.
- **12px / 8px** — elementos aninhados dentro de um card (o quadradinho da data, um bloco
  interno), sempre menores que o pai.
- **20–26px** — o que é grande e emoldura: herói vinho (22–26px), bottom sheet (26px só nos
  cantos de cima no celular, todos no desktop), pílula da aba ativa (20px).
- **Círculo puro** — avatar, anel de cobertura, ícone em disco, botão de ícone.
- **6px** — exceção única e deliberada: o raio do próprio anel de foco
  (`:focus-visible { border-radius: 6px }` em `globals.css`), para o anel abraçar texto e
  ícone sem virar pílula. Não use 6px em superfície.

A silhueta recorrente é o **disco**: o anel de cobertura, o avatar, o marcador de equipe, o
ícone do estado vazio, o brilho no canto do herói. O símbolo da marca — a cabeça de cavalo
com a chama esculpida no negativo — segue essa mesma lógica de forma cheia com vazio dentro.

### Named Rules

**A Regra do Filho Menor.** O raio de um elemento aninhado é sempre menor que o do pai
(16 → 12 → 8). Filho com raio igual ao pai faz a borda parecer errada.

**A Regra da Borda Tracejada = Ausência.** Tracejado significa "não tem nada aqui": estado
vazio, vaga aberta, anel sem ninguém. Nunca é decoração.

## Components

O caráter geral: **macio ao dedo e generoso no alvo**. Tudo responde ao toque (o alvo afunda
2,5% no `:active`, e em telas sem hover a opacidade cai a 0,72), nada tem menos de 36px de
altura, e o retorno é sempre visível — o `router.refresh()` silencioso foi substituído por
toast.

### Buttons
- **Shape:** pílula sempre (999px). Alturas 36 / 44 / 48px (`sm` / `default` / `lg`) e ícone
  quadrado 40px.
- **Primary:** vinho com texto creme-claro, sombra `soft`; no hover sobe pra `lift` e clareia
  10% (`brightness(1.1)`).
- **Accent:** dourado com texto marrom-cacau — reservado ao "sim" (Confirmar). É o único
  botão que ganha o glow dourado.
- **Outline:** superfície creme-carta com linha quente; no hover o fundo vira areia e a borda
  puxa 30% de vinho.
- **Ghost:** só texto grafite; hover em areia. Para ação terciária dentro de card.
- **Destructive:** telha com texto branco.
- **Hover / Focus / Active:** transição de 150ms em `transform, filter, background-color,
  box-shadow`; `active:scale(0.97)`; foco visível com anel de 2px em vinho-foco e offset de
  2px. Ícone interno sempre 16px.

### Chips
- **Style:** pílula em `areia` com texto `pedra` (padding 4px 10px, 12px medium). As variantes
  de estado usam a cor sólida sobre ela mesma a 12–15% de opacidade — nunca cor cheia, que
  competiria com os botões.
- **Sobre vinho:** dentro do herói, chip é `white/13%` com texto creme — a pílula fica
  legível sem furar o bloco.
- **Estado:** o chip de cobertura ganha um ponto sólido de 8px antes do texto (`3/6`), o de
  equipe ganha o ponto na cor da equipe.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** creme-carta sobre o fundo creme.
- **Shadow Strategy:** `soft` em repouso (ver Elevation). Card clicável ganha `.press`.
- **Border:** linha quente de 1px. Tracejada quando o card representa ausência.
- **Internal Padding:** 16px; cabeçalho e rodapé compartilham o mesmo padding, com o corpo
  colado no cabeçalho (`pt-0`).

### Inputs / Fields
- **Style:** superfície creme-carta (ou creme, em sheet), linha quente, raio 16px, padding
  12–16px, texto 14px. Sem sombra — campo é depressão, não elevação.
- **Focus:** `outline: none` no navegador, substituído por anel de 2px em vinho-foco com
  offset de 2px. Nunca remover sem repor.
- **Datas e horas:** valor alinhado à esquerda por regra explícita — o iOS centraliza por
  padrão e desalinha do rótulo.

### Navigation
- **Rodapé (5 abas):** `bg-card/85` com blur, linha quente no topo, respeitando `pb-safe`.
  A aba ativa é uma **pílula dourada a 40%** de 64px que **desliza** horizontalmente em 300ms
  (`cubic-bezier(.32,.72,.24,1)`) envolvendo ícone + rótulo; o ícone engrossa pra 2.3 e dá um
  `nav-pop` (escala 1.28 e volta). Rótulo 12px semibold: vinho quando ativo, pedra quando não.
- **Cabeçalho reativo:** entre 0 e 70px de rolagem o título grande encolhe 12% e apaga
  (opacidade 0 em t=0.5), o fundo blur ganha opacidade, e só depois (t=0.55) o título
  condensado central entra. Os dois títulos nunca aparecem juntos.

### Herói Vinho (assinatura)
O bloco de identidade do sistema, e o lugar onde a marca fala mais alto. Degradê diagonal de
vinho (`hsl(349 72% 28%)`) para vinho quase-preto (`hsl(349 69% 15%)`), raio 22–26px, sombra
`lift`. No canto superior direito, um disco de 176px com radial dourado a 42% **pulsa** entre
0,55 e 0,9 de opacidade num ciclo de 5s (`glow`) — é a chama da marca, respirando. Dentro:
kicker dourado caixa-alta, título display em branco, informação em creme a 85%, chips
`white/13%`, e a ação primária em dourado com glow. Um por tela.

### Anel de Cobertura (assinatura)
O relance do líder, em três formas que se distinguem **sem depender de cor**:
- **cheio** — disco musgo sólido com a fração em branco;
- **parcial** — anel `conic-gradient` em âmbar até a porcentagem, resto em areia, miolo
  creme-carta com a fração em âmbar;
- **vazio** — anel tracejado em telha a 60% com a fração em telha.

O card de evento coloca esses anéis lado a lado, um por equipe, com o nome truncado embaixo:
o estado da escala inteira em um relance, sem tabela.

### Bottom Sheet (assinatura)
Sobe com mola (340ms, `cubic-bezier(.32,.72,.24,1)`) sobre um véu grafite a 42% que faz fade
em 220ms. Alça de 5×40px em linha quente no topo, arrastável — passar de 110px fecha. Fecha
também por Escape, clique no véu e ×. Título em serifa 22px extrabold. No celular cola no
rodapé com os cantos de cima em 26px; no desktop vira diálogo centrado com todos os cantos
arredondados. Sobe junto com o teclado virtual do iOS (`liftY`).

### Celebração (assinatura)
A recompensa do sim, e o coração do North Star. Três peças que só existem em momento de
conquista: o **check que se desenha** (`stroke-dasharray` animado em 450ms), o **pop** (a
coisa incha 4,5% e volta em 500ms) e o **confete** (peças que voam do centro em 1,15s com
rotação e escala). Entrada de conquista usa `spring-in` (mola com overshoot a 1,07).

### Named Rules

**A Regra do Sem Ranking.** Conquistas, sequências e contadores falam de pertencer — "3 meses
servindo", "5 cultos" — e **nunca** comparam pessoas. Nenhum placar, nenhuma posição relativa,
nenhum "melhor voluntário do mês". Gamificação aqui é comunhão, não competição.

**A Regra do Retorno Visível.** Nenhuma ação termina em silêncio. Toast, pop, check desenhado
ou mudança de estado na hora — o que antes era um refresh mudo hoje é sempre algo que se vê.

## Do's and Don'ts

### Do:
- **Do** manter um único bloco vinho por tela e deixar o resto em creme — o vinho é
  acontecimento, não fundo.
- **Do** usar serifa (Alegreya) só onde algo tem nome próprio, e Alegreya Sans em todo texto
  corrido.
- **Do** entregar o estado em forma antes de texto: anel, fração, pílula, ponto colorido.
- **Do** abrir ação secundária em bottom sheet com alça em vez de navegar pra rota nova.
- **Do** usar as duas sombras do sistema (`soft` em repouso, `lift` no que flutua), sempre em
  marrom translúcido.
- **Do** dar ao elemento aninhado um raio menor que o do pai (16 → 12 → 8).
- **Do** celebrar a confirmação — pop, check desenhado, confete no que merece.
- **Do** respeitar `pt-safe` / `pb-safe` e `prefers-reduced-motion` (que já desliga toda a
  animação do app).
- **Do** usar `tabular-nums` em fração, contagem e hora.
- **Do** ícones Lucide em traço, tingidos por `currentColor`.

### Don't:
- **Don't** trazer cinza neutro pra dentro do sistema — borda, divisor e campo saem da linha
  quente com matiz. Cinza lê como planilha.
- **Don't** parecer dashboard de analytics: sem KPI em card cinza, sem gráfico decorativo,
  sem densidade de painel de controle. O líder quer o relance, não o relatório.
- **Don't** parecer app de igreja com clip-art: sem pombinha, sem degradê celeste, sem fonte
  manuscrita decorativa, sem emoji pictográfico (a única exceção viva no código hoje é
  `/jornada`, que contraria a convenção do repositório).
- **Don't** criar ranking, placar ou comparação entre voluntários.
- **Don't** encher o dourado em área grande — ele é chama pontual, não tinta.
- **Don't** usar musgo / âmbar / telha fora do vocabulário de cobertura, presença e risco.
- **Don't** inventar uma terceira sombra, nem usar sombra preta.
- **Don't** deixar quina viva: nada abaixo de 8px de raio, e pílula em tudo que se toca e é
  curto.
- **Don't** remover o `outline` de foco sem repor o anel de 2px em vinho-foco.
- **Don't** empilhar modal dentro de modal — painel inline dentro do card, como a linha de
  status da escala faz.
- **Don't** tratar cor e tipografia como invariantes do produto: elas são a camada da
  **igreja**. O que não muda é o esqueleto (coluna única, cinco abas, papel empilhado,
  pílulas, sheet, celebração, vocabulário).
