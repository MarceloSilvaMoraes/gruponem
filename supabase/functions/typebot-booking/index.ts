import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log("Booking Request Body:", JSON.stringify(body));

    // Mapeamento flexível para aceitar qualquer um dos nomes
    const pick = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
        const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
      }
      return null;
    };

    const action = pick(body, "action", "tipo");
    const ambienteInput = pick(body, "ambiente", "sala", "environment_name");
    const dataInput = pick(body, "data", "date");
    const inicioInput = pick(body, "inicio", "start_time", "hora_inicio");
    const fimInput = pick(body, "fim", "end_time", "hora_fim");
    const nome = pick(body, "nome", "name", "user_name");
    const phone = pick(body, "phone", "whatsapp", "remoteJid");
    const motivo = pick(body, "motivo", "description", "message");

    // 1. Lógica de Verificação de Disponibilidade
    if (action === "check" || action === "verificar") {
      // Por padrão, vamos responder que está liberado para o Typebot seguir fluxo
      // Se quiser uma verificação real, podemos adicionar o filtro de conflitos aqui
      return new Response(JSON.stringify({ 
        data: { esta_disponivel: "LIBERADO" },
        esta_disponivel: "LIBERADO" 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Busca/Criação do Ambiente (Essencial para o ID)
    let envId = null;
    if (ambienteInput) {
      const cleanName = String(ambienteInput).trim();
      const { data: env } = await supabase.from('environments')
        .select('id')
        .ilike('name', cleanName)
        .single();
      
      if (env) {
        envId = env.id;
      } else {
        const { data: newEnv } = await supabase.from('environments')
          .insert({ name: cleanName })
          .select('id').single();
        envId = newEnv?.id;
      }
    }

    // 3. Normalização de Data/Hora (Garante formato ISO para o Supabase)
    const normalizeDate = (d: string, t: string) => {
      if (!d || !t) return null;
      let datePart = d.includes('/') ? d.split('/').reverse().join('-') : d;
      let timePart = t.includes('h') ? t.replace('h', ':') : t;
      if (!timePart.includes(':')) timePart += ':00';
      return `${datePart}T${timePart.padStart(5, '0')}:00`;
    };

    const startTime = normalizeDate(dataInput, inicioInput);
    const endTime = normalizeDate(dataInput, fimInput || "23:59");

    if (!startTime || !envId) {
      throw new Error(`Dados incompletos: Sala=${ambienteInput}, Data=${dataInput}, Hora=${inicioInput}`);
    }

    // 4. Inserção na Tabela Bookings
    const { data: booking, error } = await supabase.from("bookings").insert({
      environment_id: envId,
      requester_name: nome || "Usuário WhatsApp",
      requester_phone: String(phone || "").replace(/\D/g, ""),
      start_time: startTime,
      end_time: endTime,
      description: motivo || "Reserva via Bot",
      status: "confirmed"
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Reserva salva com sucesso!", 
      booking_id: booking.id,
      esta_disponivel: "LIBERADO"
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e: any) {
    console.error("Booking Error:", e.message);
    return new Response(JSON.stringify({ error: e.message, status: "error" }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
