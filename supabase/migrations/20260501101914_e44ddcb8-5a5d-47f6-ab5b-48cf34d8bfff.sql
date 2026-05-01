-- NPS no ticket
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS nps_score smallint,
  ADD COLUMN IF NOT EXISTS nps_comment text,
  ADD COLUMN IF NOT EXISTS nps_submitted_at timestamptz;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_nps_score_range;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_nps_score_range
  CHECK (nps_score IS NULL OR (nps_score BETWEEN 1 AND 5));

-- Sender label para mensagens (bot, system, user, agent)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_label text;
