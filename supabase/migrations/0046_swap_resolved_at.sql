-- 0046 — auditoria de quando o pedido de troca foi resolvido.
--
-- Existia `resolved_by` (QUEM resolveu) e faltava o QUANDO. Isso apareceu num
-- caso real (31/jul): Moisés pediu troca sugerindo Pedro, Pedro recusou, e
-- ninguém — nem o Moisés, nem os líderes, nem o admin — foi avisado. Ao
-- investigar, não havia como saber a que hora a recusa aconteceu, porque as
-- ações do substituto não gravavam horário nem registravam atividade.
--
-- O aviso e o log de atividade foram corrigidos no app (aceitarSubstituicao /
-- recusarSubstituicao). Esta coluna fecha o rastro do lado do banco.

alter table public.swap_requests add column if not exists resolved_at timestamptz;

comment on column public.swap_requests.resolved_at is
  'Quando o pedido saiu de pendente (recusa do substituto ou decisão do líder). Nulo nos pedidos resolvidos antes de 31/jul/2026, quando a coluna não existia.';
