
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  requester_name text,
  requester_phone text,
  requester_email text,
  requester_sector text,
  item text NOT NULL,
  quantity numeric DEFAULT 1,
  supplier text,
  estimated_value numeric,
  justification text,
  status text NOT NULL DEFAULT 'pendente',
  source text NOT NULL DEFAULT 'typebot',
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view budgets" ON public.budgets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated update budgets" ON public.budgets
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins delete budgets" ON public.budgets
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated insert budgets" ON public.budgets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service insert budgets" ON public.budgets
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Service select budgets" ON public.budgets
  FOR SELECT TO anon USING (true);

CREATE TRIGGER trg_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
