-- WS2.1 — novo tipo de aviso: líder recebe "novo evento precisa da sua equipe"
-- quando o admin cria um evento que inclui a equipe dele.
alter type public.notification_kind add value if not exists 'evento_equipe';
