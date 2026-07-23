-- Marca quando o culto foi encerrado (congela o relógio do modo ao vivo).
alter table events add column if not exists rundown_ended_at timestamptz;