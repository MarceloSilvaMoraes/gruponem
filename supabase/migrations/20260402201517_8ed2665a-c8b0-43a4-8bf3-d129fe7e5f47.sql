
-- Create enum types
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- Contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  profile_pic_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);

-- Tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  category TEXT,
  subject TEXT,
  ai_summary TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tickets" ON public.tickets FOR DELETE TO authenticated USING (true);

-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  direction public.message_direction NOT NULL DEFAULT 'inbound',
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

-- Also allow service role and anon to insert (for webhook edge function)
CREATE POLICY "Service can insert contacts" ON public.contacts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service can select contacts" ON public.contacts FOR SELECT TO anon USING (true);
CREATE POLICY "Service can update contacts" ON public.contacts FOR UPDATE TO anon USING (true);
CREATE POLICY "Service can insert tickets" ON public.tickets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service can select tickets" ON public.tickets FOR SELECT TO anon USING (true);
CREATE POLICY "Service can update tickets" ON public.tickets FOR UPDATE TO anon USING (true);
CREATE POLICY "Service can insert messages" ON public.messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service can select messages" ON public.messages FOR SELECT TO anon USING (true);

-- Indexes
CREATE INDEX idx_tickets_contact_id ON public.tickets(contact_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_messages_ticket_id ON public.messages(ticket_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone);

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
