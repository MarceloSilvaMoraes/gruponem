
-- Tabelas para o Sistema de Estoque e Logística Intermunicipal

-- 1. Unidades (Municípios/Filiais)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    municipality TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Setores (Vinculados às Unidades)
CREATE TABLE IF NOT EXISTS public.sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Catálogo de Itens de Estoque
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    sku TEXT UNIQUE,
    min_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Saldo de Estoque por Setor
CREATE TABLE IF NOT EXISTS public.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id, sector_id)
);

-- 5. Registro de Transferências e Logística (Frete)
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id),
    origin_sector_id UUID REFERENCES public.sectors(id),
    destination_sector_id UUID REFERENCES public.sectors(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    freight_cost DECIMAL(10,2) DEFAULT 0.00,
    carrier_name TEXT, -- Transportadora ou responsável
    tracking_code TEXT,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_transito', 'recebido', 'cancelado')),
    sent_at TIMESTAMPTZ DEFAULT now(),
    received_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Leitura para todos, Escrita para Admins)
CREATE POLICY "Leitura pública para usuários autenticados" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura pública para usuários autenticados" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura pública para usuários autenticados" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura pública para usuários autenticados" ON public.stock_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura pública para usuários autenticados" ON public.inventory_transfers FOR SELECT TO authenticated USING (true);

-- Trigger para atualizar timestamp de estoque
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_levels_updated_at BEFORE UPDATE ON public.stock_levels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
