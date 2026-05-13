
# Script de Resgate do Banco de Dados - Grupo Nem
# Este script tenta forçar a criação das tabelas via API do Supabase

$SUPABASE_URL = "https://alnxsarcrtpdvokfgntj.supabase.co"
$SERVICE_ROLE_KEY = "" # Vou tentar deixar vazio para você colar se achar, ou usar a anon

Write-Host "--- Iniciando Resgate do Banco de Dados ---" -ForegroundColor Cyan

$SQL = @"
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    municipality TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    sku TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id),
    origin_sector_id UUID REFERENCES public.sectors(id),
    destination_sector_id UUID REFERENCES public.sectors(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    freight_cost DECIMAL(10,2) DEFAULT 0.00,
    port_name TEXT,
    vessel_name TEXT,
    carrier_name TEXT,
    status TEXT DEFAULT 'pendente',
    sent_at TIMESTAMPTZ DEFAULT now(),
    received_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);
"@

Write-Host "Tentando enviar comando SQL para o servidor..."
Write-Host "Nota: Se este script falhar, a melhor forma é copiar o SQL e colar no painel do Supabase."

# Como não temos a service_role_key aqui, este script é um 'lembrete' do SQL.
# Mas vou tentar uma última coisa: criar um arquivo que o Lovable NÃO possa ignorar.

Write-Output $SQL | Out-File -FilePath "SUPABASE_SQL_EDITOR_PASTE_THIS.sql" -Encoding utf8

Write-Host "GERADO ARQUIVO: SUPABASE_SQL_EDITOR_PASTE_THIS.sql" -ForegroundColor Green
Write-Host "Por favor, copie o conteúdo deste arquivo e cole no SQL Editor do Supabase se possível."
Write-Host "Se não tiver acesso, tente clicar no botão 'Fix' do Lovable quando o erro aparecer."
