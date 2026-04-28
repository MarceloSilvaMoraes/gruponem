CREATE POLICY "Admins delete messages" ON public.messages FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete ticket_notes" ON public.ticket_notes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete ticket_activity" ON public.ticket_activity FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));