import { redirect } from "next/navigation";

/**
 * A página "Novo evento" morreu — virou um modal de 3 passos dentro de /escalas.
 * A ROTA fica de pé porque ainda é linkada de fora (o "‹ Novo evento" de
 * /modelos, o botão da casca de /escalas/[id]) e pode estar num favorito: um 404
 * no meio de "criar o culto de domingo" é o pior desfecho possível.
 *
 * Ela vira porta: manda pra /escalas pedindo o wizard aberto, com a data no
 * bolso. Quem abre e limpa a URL é o `CalendarioGaveta`, do outro lado.
 *
 * Sem `getSession()` de propósito: o middleware já barra quem não está logado,
 * e mesmo o wizard estando MONTADO pra todo mundo dentro do `CalendarioGaveta`,
 * só abre pra admin — as duas guardas (a prop `autoOpenNovo={isAdmin && …}` de
 * `escalas/page.tsx` e o `podeCriar` de dentro do próprio `CalendarioGaveta`)
 * resolvem isso, além de `criarEventoAvulso` recusar não-admin no servidor
 * (actions.ts:1051). Uma consulta a menos numa rota que só existe pra
 * redirecionar.
 */
export default async function NovoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(data ?? "") ? `&data=${data}` : "";
  redirect(`/escalas?novo=1${dia}`);
}
