// Paleta de Categoria — as cores LIVRES do app: equipe e bloco de roteiro.
//
// Por que existe: a trinca musgo/âmbar/telha é vocabulário de ESTADO de escala
// (cheio / parcial / vazio) e nada mais — "A Regra do Semáforo Fechado" no
// DESIGN.md. Categoria precisa de cores próprias, que não digam "confirmado" nem
// "vaga aberta". E "A Regra da Borda Quente" proíbe cinza neutro: nada de
// #6b7280 de biblioteca — todo tom aqui tem matiz e terra.
//
// Esta é a fonte única desses valores no código; os mesmos hexes estão
// registrados no frontmatter do DESIGN.md (`cat-*`), que é o que o detector do
// impeccable lê pra saber que são cores do sistema — por isso NÃO existe exceção
// registrada em .impeccable/config.json.
//
// Os 10 tons abrem em matizes espalhadas (17° → 336°) pra que dois pontinhos
// vizinhos nunca se confundam, mas todas ficam abafadas (S 16–53%) pra pertencer
// à casa de creme e vinho.

export type CategoryColor = { hex: string; name: string };

export const CATEGORY_PALETTE: CategoryColor[] = [
  { hex: "#C4633E", name: "Terracota" },
  { hex: "#5B6B4E", name: "Oliva" },
  { hex: "#4E86A6", name: "Azul de Fundo" },
  { hex: "#7C6BAF", name: "Ameixa" },
  { hex: "#B0894A", name: "Dourado de Barro" },
  { hex: "#3F6F5B", name: "Verde-Garrafa" },
  { hex: "#9C4A6B", name: "Framboesa" },
  { hex: "#8C5B3F", name: "Cacau" },
  { hex: "#3E7F86", name: "Turquesa Fosca" },
  { hex: "#5F6D8C", name: "Ardósia" },
];

/** Pedra (o mesmo tom do texto secundário). Categoria sem cor definida. */
export const CATEGORY_NEUTRAL = "#736459";

export const CATEGORY_HEXES: string[] = CATEGORY_PALETTE.map((c) => c.hex);

/**
 * Próxima cor da paleta que ninguém está usando ainda — é assim que equipe e
 * bloco novos nascem com cor PRÓPRIA. Antes havia um default fixo, e por isso
 * 4 das 8 equipes da Aliança acabaram com o mesmo pontinho verde: o ponto é o
 * jeito do app dizer "essa é a sua equipe", e repetido ele não diz nada.
 * Esgotada a paleta, recomeça do tom menos repetido.
 */
export function nextCategoryColor(used: Iterable<string>): string {
  const count = new Map<string, number>(CATEGORY_HEXES.map((h) => [h, 0]));
  for (const raw of used) {
    const hex = (raw ?? "").trim().toUpperCase();
    for (const h of CATEGORY_HEXES) {
      if (h.toUpperCase() === hex) count.set(h, (count.get(h) ?? 0) + 1);
    }
  }
  let best = CATEGORY_HEXES[0];
  let bestCount = Number.POSITIVE_INFINITY;
  for (const h of CATEGORY_HEXES) {
    const c = count.get(h) ?? 0;
    if (c < bestCount) {
      best = h;
      bestCount = c;
    }
  }
  return best;
}
