
-- Add contact fields
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_unique
  ON public.contacts (lower(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts (user_id);

-- Helper: get contact ids tied to current user
CREATE OR REPLACE FUNCTION public.current_user_contact_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.contacts WHERE user_id = auth.uid();
$$;

-- Update handle_new_user to: link contact by email, default end_user role unless first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_contact uuid;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);

  -- Try to link to existing contact by email
  UPDATE public.contacts
    SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email) AND user_id IS NULL
    RETURNING id INTO matched_contact;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSIF matched_contact IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'end_user');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'attendant');
  END IF;
  RETURN NEW;
END;
$$;

-- RLS: end users can view their own tickets
DROP POLICY IF EXISTS "End users view own tickets" ON public.tickets;
CREATE POLICY "End users view own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (contact_id IN (SELECT public.current_user_contact_ids()));

DROP POLICY IF EXISTS "End users view own messages" ON public.messages;
CREATE POLICY "End users view own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = messages.ticket_id
      AND t.contact_id IN (SELECT public.current_user_contact_ids())
  ));

DROP POLICY IF EXISTS "End users view own ticket activity" ON public.ticket_activity;
CREATE POLICY "End users view own ticket activity"
  ON public.ticket_activity FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_activity.ticket_id
      AND t.contact_id IN (SELECT public.current_user_contact_ids())
  ));

-- End users can view their own contact row
DROP POLICY IF EXISTS "End users view own contact" ON public.contacts;
CREATE POLICY "End users view own contact"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
