CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    environment_id UUID REFERENCES public.environments(id) ON DELETE CASCADE,
    requester_name TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "View all bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bookings" ON public.bookings FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Public insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
