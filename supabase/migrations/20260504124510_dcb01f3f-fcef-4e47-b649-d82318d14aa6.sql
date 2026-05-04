-- Co-atendentes: vários membros podem participar do mesmo chamado
CREATE TABLE IF NOT EXISTS public.ticket_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  user_id UUID NOT NULL,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_ticket ON public.ticket_assignees(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignees_user ON public.ticket_assignees(user_id);

ALTER TABLE public.ticket_assignees ENABLE ROW LEVEL SECURITY;

-- Função helper para evitar recursão nas RLS de tickets
CREATE OR REPLACE FUNCTION public.is_ticket_co_assignee(_ticket_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ticket_assignees
    WHERE ticket_id = _ticket_id AND user_id = _user_id
  )
$$;

-- RLS para ticket_assignees
CREATE POLICY "View assignees of accessible tickets"
ON public.ticket_assignees FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_assignees.ticket_id
      AND (
        is_admin(auth.uid())
        OR t.assigned_to = auth.uid()
        OR t.assigned_to IS NULL
        OR public.is_ticket_co_assignee(t.id, auth.uid())
      )
  )
);

CREATE POLICY "Admins or owner manage assignees - insert"
ON public.ticket_assignees FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_assignees.ticket_id
      AND (t.assigned_to = auth.uid() OR t.assigned_to IS NULL)
  )
);

CREATE POLICY "Admins or owner manage assignees - delete"
ON public.ticket_assignees FOR DELETE TO authenticated
USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_assignees.ticket_id
      AND t.assigned_to = auth.uid()
  )
);

-- Atualiza políticas existentes para considerar co-atendentes
DROP POLICY IF EXISTS "View tickets by role" ON public.tickets;
CREATE POLICY "View tickets by role"
ON public.tickets FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR assigned_to = auth.uid()
  OR assigned_to IS NULL
  OR public.is_ticket_co_assignee(id, auth.uid())
);

DROP POLICY IF EXISTS "Update tickets by role" ON public.tickets;
CREATE POLICY "Update tickets by role"
ON public.tickets FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR assigned_to = auth.uid()
  OR assigned_to IS NULL
  OR public.is_ticket_co_assignee(id, auth.uid())
);

DROP POLICY IF EXISTS "View messages of accessible tickets" ON public.messages;
CREATE POLICY "View messages of accessible tickets"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = messages.ticket_id
      AND (
        is_admin(auth.uid())
        OR t.assigned_to = auth.uid()
        OR t.assigned_to IS NULL
        OR public.is_ticket_co_assignee(t.id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Insert messages on accessible tickets" ON public.messages;
CREATE POLICY "Insert messages on accessible tickets"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = messages.ticket_id
      AND (
        is_admin(auth.uid())
        OR t.assigned_to = auth.uid()
        OR public.is_ticket_co_assignee(t.id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "View notes of accessible tickets" ON public.ticket_notes;
CREATE POLICY "View notes of accessible tickets"
ON public.ticket_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_notes.ticket_id
      AND (
        is_admin(auth.uid())
        OR t.assigned_to = auth.uid()
        OR t.assigned_to IS NULL
        OR public.is_ticket_co_assignee(t.id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "View activity of accessible tickets" ON public.ticket_activity;
CREATE POLICY "View activity of accessible tickets"
ON public.ticket_activity FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_activity.ticket_id
      AND (
        is_admin(auth.uid())
        OR t.assigned_to = auth.uid()
        OR t.assigned_to IS NULL
        OR public.is_ticket_co_assignee(t.id, auth.uid())
      )
  )
);