import { redirect } from "next/navigation";

/**
 * /calendario morreu: o calendário virou GAVETA dentro de /escalas (uma página
 * só, decisão do dono). A rota NÃO foi deletada de propósito — existem 27
 * notificações JÁ GRAVADAS no banco com `link: "/calendario"` e o service worker
 * abre esse mesmo link quando o push é tocado (`public/sw.js:29`). Sem este
 * redirect, cada um desses avisos vira 404 — tela morta na mão de quem confiou
 * no aviso.
 *
 * 307 (o padrão de `redirect`) e não 308: 308 fica cacheado pra sempre no
 * navegador, e a gente não pode fechar a porta de vez numa rota de produção.
 *
 * A query é descartada pelo redirect. Conferido no banco: as 27 notificações
 * existentes são todas `/calendario` puro (a mais nova é de 29/jul, e a
 * telemetria de canal entrou em 10/ago), e a partir desta mudança as novas
 * apontam pra /escalas. Não há `?via=` a perder.
 */
export default function CalendarioPage() {
  redirect("/escalas");
}
