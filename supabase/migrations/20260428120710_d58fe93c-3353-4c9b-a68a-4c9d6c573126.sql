-- Trigger keywords table
CREATE TABLE public.trigger_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  description TEXT,
  typebot_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trigger_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view triggers"
  ON public.trigger_keywords FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage triggers"
  ON public.trigger_keywords FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service can read triggers"
  ON public.trigger_keywords FOR SELECT TO anon USING (true);

CREATE TRIGGER update_trigger_keywords_updated_at
  BEFORE UPDATE ON public.trigger_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add description + source to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS trigger_keyword TEXT;

-- Seed a couple of defaults
INSERT INTO public.trigger_keywords (keyword, description, active)
VALUES
  ('suporte01', 'Suporte técnico geral', true),
  ('suporte02', 'Solicitação de acesso/sistema', true)
ON CONFLICT (keyword) DO NOTHING;