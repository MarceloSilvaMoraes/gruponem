-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'attendant');

-- 2. Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de papéis
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Funções security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- 5. Políticas profiles
CREATE POLICY "View all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- 6. Políticas user_roles
CREATE POLICY "View roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 7. Trigger criar profile + role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'attendant');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. RLS de tickets
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can insert tickets" ON public.tickets;

CREATE POLICY "View tickets by role" ON public.tickets FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "Insert tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update tickets by role" ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "Admins delete tickets" ON public.tickets FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 9. RLS de messages
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;

CREATE POLICY "View messages of accessible tickets" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = messages.ticket_id
    AND (public.is_admin(auth.uid()) OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL)));
CREATE POLICY "Insert messages on accessible tickets" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = messages.ticket_id
    AND (public.is_admin(auth.uid()) OR t.assigned_to = auth.uid())));

-- 10. Notas internas
CREATE TABLE public.ticket_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View notes of accessible tickets" ON public.ticket_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_notes.ticket_id
    AND (public.is_admin(auth.uid()) OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL)));
CREATE POLICY "Add notes" ON public.ticket_notes FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Delete own notes or admin" ON public.ticket_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- 11. Histórico
CREATE TABLE public.ticket_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View activity of accessible tickets" ON public.ticket_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_activity.ticket_id
    AND (public.is_admin(auth.uid()) OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL)));
CREATE POLICY "Insert activity" ON public.ticket_activity FOR INSERT TO authenticated WITH CHECK (true);

-- 12. Trigger auditoria
CREATE OR REPLACE FUNCTION public.log_ticket_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_activity (ticket_id, actor_id, action, to_value)
    VALUES (NEW.id, auth.uid(), 'created', NEW.status::text);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_activity (ticket_id, actor_id, action, from_value, to_value)
    VALUES (NEW.id, auth.uid(), 'status_changed', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.ticket_activity (ticket_id, actor_id, action, from_value, to_value)
    VALUES (NEW.id, auth.uid(),
      CASE WHEN OLD.assigned_to IS NULL THEN 'claimed' WHEN NEW.assigned_to IS NULL THEN 'unassigned' ELSE 'reassigned' END,
      OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.ticket_activity (ticket_id, actor_id, action, from_value, to_value)
    VALUES (NEW.id, auth.uid(), 'priority_changed', OLD.priority::text, NEW.priority::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_log_changes
  AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status_v2 ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket ON public.ticket_notes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket ON public.ticket_activity(ticket_id);