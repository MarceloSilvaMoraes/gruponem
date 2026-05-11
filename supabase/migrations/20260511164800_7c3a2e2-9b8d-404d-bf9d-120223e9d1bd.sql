
-- Atualização para o Fluxo de Logística Ribeirinha e Aprovações

-- Adicionar colunas de fluxo na tabela de transferências
ALTER TABLE public.inventory_transfers 
ADD COLUMN IF NOT EXISTS port_name TEXT,
ADD COLUMN IF NOT EXISTS vessel_name TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'saida' CHECK (request_type IN ('saida', 'transferencia', 'compra'));

-- Atualizar o check de status para incluir as novas etapas
ALTER TABLE public.inventory_transfers DROP CONSTRAINT IF EXISTS inventory_transfers_status_check;
ALTER TABLE public.inventory_transfers ADD CONSTRAINT inventory_transfers_status_check 
CHECK (status IN ('pendente', 'cotacao', 'aguardando_aprovacao', 'liberado_logistica', 'em_transito', 'recebido', 'cancelado'));

-- Tabela de Portos e Embarcações Frequentes (Para facilitar a seleção)
CREATE TABLE IF NOT EXISTS public.logistics_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('porto', 'embarcacao', 'transportadora')),
    name TEXT NOT NULL,
    contact_info TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logistics_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública para usuários autenticados" ON public.logistics_partners FOR SELECT TO authenticated USING (true);
