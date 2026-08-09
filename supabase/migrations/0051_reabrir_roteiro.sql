-- 0051 — REABRIR O ROTEIRO (o desfazer do encerramento)
--
-- 09/08/2026, culto do Dia dos Pais: a Produção iniciou às 13:10:40 e encerrou
-- às 13:10:45. QUATRO SEGUNDOS E MEIO. Ninguém encerra um culto em 5 segundos —
-- foi toque duplo num botão que não respondeu na hora, e na régia o "Encerrar"
-- nasce no mesmo pixel onde estava o "Iniciar".
--
-- O estrago não foi o encerramento em si: foi não haver volta. O único remédio
-- existente era `reiniciar_roteiro`, que apaga o start E TODOS OS TIQUES —
-- remédio pior que a doença com o culto rolando. Sem saída, a Produção
-- abandonou o culto de hoje e foi trabalhar no roteiro do próximo domingo.
--
-- Esta função é a saída que faltava: limpa SÓ o `rundown_ended_at`. O start
-- original continua valendo (os horários projetados não se mexem) e os tiques
-- dos blocos continuam onde estavam. Encerrar deixa de ser uma porta de mão
-- única.
--
-- Idempotente igual às irmãs da 0049: reabrir o que já está aberto não é erro,
-- é o estado desejado. Assim dois toques no "Desfazer" não brigam entre si —
-- que é, afinal, exatamente o bug que estamos consertando.

create or replace function public.reabrir_roteiro(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_existe boolean;
begin
  if not public.pode_conduzir_roteiro() then
    raise exception 'Sem permissão para conduzir o roteiro.';
  end if;
  select true into v_existe from public.events where id = p_event for update;
  if v_existe is null then
    raise exception 'Culto inexistente.';
  end if;
  update public.events set rundown_ended_at = null where id = p_event;
end;
$$;
grant execute on function public.reabrir_roteiro(uuid) to authenticated;
