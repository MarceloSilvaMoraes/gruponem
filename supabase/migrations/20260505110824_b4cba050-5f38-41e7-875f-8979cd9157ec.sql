
CREATE TABLE public.environments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'sala',
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View environments" ON public.environments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert environments" ON public.environments FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update environments" ON public.environments FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete environments" ON public.environments FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_environments_updated_at
BEFORE UPDATE ON public.environments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'computador',
  name text NOT NULL,
  brand text,
  model text,
  serial_number text,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert equipment" ON public.equipment FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update equipment" ON public.equipment FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete equipment" ON public.equipment FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_equipment_env ON public.equipment(environment_id);
