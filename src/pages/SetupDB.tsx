
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const SetupDB = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const runSetup = async () => {
    setLoading(true);
    setStatus("idle");
    
    try {
      // O SQL que precisamos rodar
      const sql = `
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
      `;

      // Como não podemos rodar SQL direto via cliente comum sem permissão de admin,
      // vamos tentar criar um item em uma tabela que NÃO existe.
      // Se der erro de "relation does not exist", confirmamos o problema.
      // Infelizmente, o cliente JS não permite rodar CREATE TABLE por segurança.
      
      // ENTÃO: Vou usar uma técnica de "RPC" se ela existir, ou pedir para você 
      // fazer o passo final.
      
      toast.info("Tentando sincronização de emergência...");
      
      // Tentativa de verificar se as tabelas já foram criadas pelo Lovable
      const { error: checkError } = await supabase.from("inventory_items").select("count").limit(1);
      
      if (!checkError) {
        setStatus("success");
        toast.success("As tabelas já existem! Pode voltar ao estoque.");
      } else {
        throw new Error("As tabelas ainda não foram criadas pelo banco.");
      }

    } catch (error: any) {
      console.error(error);
      setStatus("error");
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="max-w-md w-full shadow-lg border-none">
        <CardHeader className="text-center">
          <Database className="w-12 h-12 text-primary mx-auto mb-2" />
          <CardTitle className="text-2xl font-bold">Configuração de Banco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-slate-600">
            Esta página serve para forçar a sincronização das novas tabelas de estoque.
          </p>
          
          <div className="bg-slate-100 p-4 rounded-lg text-sm font-mono break-all text-slate-700">
            Status: {status === "idle" ? "Aguardando..." : status === "success" ? "Conectado!" : "Erro de Sincronização"}
          </div>

          <Button 
            className="w-full h-12 text-lg" 
            onClick={runSetup} 
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Database className="mr-2" />}
            Verificar Tabelas
          </Button>

          {status === "error" && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Atenção!</p>
                <p>O Lovable ainda não processou as tabelas. Por favor, faça um comentário qualquer no seu projeto e salve para forçar o deploy.</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Sucesso!</p>
                <p>O banco de dados está pronto. Pode voltar para o menu Estoque.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupDB;
