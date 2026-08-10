// QUAL CULTO A TELA ABRE.
//
// Mora fora de `data.ts` de propósito: é decisão pura, sem Supabase e sem
// `next/headers`, então dá pra exercitar com dados na mão (ver a nota no fim do
// arquivo). A aba Roteiro e a régia importam esta mesma função — quando as duas
// telas divergem sobre qual é "o culto", é assim que nasce um domingo perdido.

import { churchDateISO } from "@/lib/format";

/** O mínimo que a decisão precisa saber sobre um culto. */
export type CultoDecidivel = {
  ev: { id: string; starts_at: string };
  startedAt: string | null;
  endedAt: string | null;
};

/**
 * A regra que faltava em 09/08/2026.
 *
 * Naquele dia o critério era só "o primeiro que não está encerrado". Quando a
 * Produção encerrou o culto de hoje sem querer, ele saiu da conta e a tela
 * deslizou sozinha, sem avisar, para o próximo culto aberto — o do domingo
 * seguinte, que a equipe passou a manhã editando achando que era o de hoje.
 * Ninguém escolheu o culto errado: a tela escolheu, e ficou calada.
 *
 * A ordem agora é:
 *   1. `?ev=` — pedido explícito manda sempre, inclusive em culto encerrado.
 *   2. ROTEIRO EM ANDAMENTO, em qualquer data. Se alguém já está conduzindo um
 *      culto, é NELE que a régia tem que estar, mesmo que a data seja outra.
 *   3. CULTO DE HOJE, mesmo sem iniciar — a régia abre de manhã e a conversa
 *      pré-culto acontece muito antes de qualquer "iniciar". Encerrado ainda
 *      conta: um culto de hoje encerrado por engano é exatamente onde a pessoa
 *      precisa estar pra desfazer, não motivo pra empurrá-la pra outra semana.
 *   4. Só então o próximo aberto.
 *
 * Devolve o índice em `candidatos`, ou -1 se não há nada pra mostrar.
 */
export function escolherCulto<T extends CultoDecidivel>(candidatos: T[], evParam?: string): number {
  if (candidatos.length === 0) return -1;

  if (evParam) {
    const pedido = candidatos.findIndex((c) => c.ev.id === evParam);
    if (pedido >= 0) return pedido;
  }

  const rodando = candidatos.findIndex((c) => c.startedAt && !c.endedAt);
  if (rodando >= 0) return rodando;

  const hoje = churchDateISO(new Date().toISOString());
  const deHoje = candidatos
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => churchDateISO(c.ev.starts_at) === hoje);
  if (deHoje.length > 0) {
    const agora = Date.now();
    // Aberto ganha de encerrado; empatou, vence o mais perto do horário de agora
    // (igreja com culto de manhã e de noite no mesmo domingo).
    deHoje.sort((a, b) => {
      const fim = (a.c.endedAt ? 1 : 0) - (b.c.endedAt ? 1 : 0);
      if (fim !== 0) return fim;
      return (
        Math.abs(new Date(a.c.ev.starts_at).getTime() - agora) -
        Math.abs(new Date(b.c.ev.starts_at).getTime() - agora)
      );
    });
    return deHoje[0].i;
  }

  return candidatos.findIndex((c) => !c.endedAt);
}

/** O culto mostrado é de hoje? Move o selo de data da régia. */
export function ehDeHoje(startsAt: string): boolean {
  return churchDateISO(startsAt) === churchDateISO(new Date().toISOString());
}

/**
 * O culto já ficou pra trás no CALENDÁRIO (data da igreja, não hora)?
 *
 * É esta a pergunta que decide se um culto encerrado pode sair do seletor — e
 * não `ehDeHoje`, como era até 10/08/2026. Naquele dia o Culto de Oração de
 * QUINTA (dia 14) foi encerrado por engano numa terça e evaporou da aba Roteiro:
 * encerrado ✔, de hoje ✘ — sumiu. Sem o chip na tela não havia como reabrir, e o
 * "encerrado" ficou de pé num culto que ainda nem aconteceu.
 *
 * A regra certa é a do calendário: encerrado só desaparece depois que o dia
 * passou (aí ele mora em Finalizados, na aba Escalas). Culto de hoje ou de
 * qualquer dia à frente FICA, encerrado ou não — porque encerramento em culto
 * que não passou é acidente até prova em contrário, e acidente precisa de porta.
 */
export function jaPassou(startsAt: string): boolean {
  return churchDateISO(startsAt) < churchDateISO(new Date().toISOString());
}
