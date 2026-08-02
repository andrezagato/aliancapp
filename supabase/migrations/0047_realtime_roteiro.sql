-- 0047 — roteiro em tempo real.
--
-- Pedido do André (02/ago): "uma pessoa atualiza e só aparece pros outros se
-- forçar refresh". No meio do culto ninguém tem mão livre pra puxar a tela.
--
-- `event_rundown` = conteúdo dos blocos (título, duração, ordem, o check de
-- concluído). `events` = início e fim do culto, pra tela dos outros sair de
-- "não começou" pra "ao vivo" sozinha.
--
-- A RLS continua valendo: o Realtime do Supabase aplica as policies do usuário
-- que assina o canal, então ninguém recebe evento de igreja/culto que não podia
-- ver no app.
alter publication supabase_realtime add table public.event_rundown;
alter publication supabase_realtime add table public.events;
