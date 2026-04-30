
-- Settings table (key/value)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete settings" ON public.app_settings FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_app_settings_updated
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value) VALUES ('app_name', 'Suporte') ON CONFLICT (key) DO NOTHING;

-- Computers table
CREATE TABLE public.computers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hostname text,
  ip_address text,
  mac_address text,
  sector text,
  responsible text,
  operating_system text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.computers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View computers" ON public.computers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert computers" ON public.computers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update computers" ON public.computers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete computers" ON public.computers FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_computers_updated
BEFORE UPDATE ON public.computers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
