import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log("Incoming request body:", JSON.stringify(body));
    
    // Helper para pegar campos com nomes variados
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        if (body[k] !== undefined && body[k] !== null) return body[k];
      }
      return undefined;
    };

    const action = pick("action", "event", "tipo");
    const envInput = pick("environment_name", "sala", "ambiente", "p_room_name", "local");
    const dateInput = pick("date", "data", "p_date");
    const startTimeInput = pick("start_time", "inicio", "p_start", "hora_inicio");
    const endTimeInput = pick("end_time", "fim", "p_end", "hora_fim");
    const category = pick("category", "categoria");
    const name = pick("name", "nome", "p_name", "user_name");
    const phone = pick("phone", "whatsapp", "p_phone", "remoteJid");
    const subject = pick("subject", "assunto", "p_subject");
    const description = pick("description", "mensagem", "message", "p_message", "p_desc");

    // Função Universal de Normalização de Data/Hora
    const normalizeDateTime = (dStr: string, tStr: string) => {
      if (!dStr || !tStr) return null;
      let datePart = String(dStr).trim().replace(/\//g, '-');
      if (datePart.match(/^\d{1,2}-\d{1,2}$/)) {
        datePart = `${new Date().getFullYear()}-${datePart.split('-')[1].padStart(2, '0')}-${datePart.split('-')[0].padStart(2, '0')}`;
      } else if (datePart.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const [d, m, y] = datePart.split('-');
        datePart = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      let timePart = String(tStr).trim().toLowerCase().replace('h', ':').replace(' ', '');
      if (!timePart.includes(':')) timePart += ':00';
      const parts = timePart.split(':');
      const h = parts[0].padStart(2, '0');
      const m = (parts[1] || '00').padEnd(2, '0').substring(0, 2);
      try {
        const d = new Date(`${datePart}T${h}:${m}:00`);
        return isNaN(d.getTime()) ? null : d;
      } catch { return null; }
    };

    // Função de Busca Flexível de Ambiente
    const findEnvironmentFlexibly = async (nameInput: string) => {
      if (!nameInput) return null;
      const cleanInput = nameInput.toLowerCase().replace(/\s/g, '').replace(/0(?=\d)/g, '');
      
      // Busca apenas na tabela em português que vimos no seu print
      const { data: envs } = await supabase.from('ambientes').select('id, name');
      
      return envs?.find(e => {
        const dbClean = e.name.toLowerCase().replace(/\s/g, '').replace(/0(?=\d)/g, '');
        return dbClean === cleanInput || e.name.toLowerCase().includes(nameInput.toLowerCase());
      });
    };

    // ========= MODO: CHECK (Verificação de Disponibilidade) =========
    if (action === "check" || action === "check_availability") {
      const startReq = normalizeDateTime(dateInput, startTimeInput);
      const endReq = normalizeDateTime(dateInput, endTimeInput || (startTimeInput ? `${parseInt(startTimeInput)+1}:00` : ""));

      if (!startReq) return json({ available: false, esta_disponivel: false, message: "Data/Hora inválida" });

      const env = await findEnvironmentFlexibly(envInput);
      if (!env) {
        return json({ available: true, esta_disponivel: true, message: "Ambiente novo - Disponível" });
      }

      const { data: bookings } = await supabase
        .from('reservas')
        .select('start_time, end_time')
        .eq('environment_id', env.id)
        .neq('status', 'cancelled');

      const sTime = startReq.getTime();
      const eTime = endReq ? endReq.getTime() : sTime + 3600000;

      const conflict = bookings?.some(b => {
        const bS = new Date(b.start_time).getTime();
        const bE = new Date(b.end_time).getTime();
        return bS < eTime && bE > sTime;
      });

      return json({ 
        available: !conflict, 
        esta_disponivel: !conflict,
        ok: !conflict,
        message: conflict ? "Ocupado" : "Horário disponível" 
      });
    }

    // ========= MODO: INSERT (Criação de Agendamento ou Ticket) =========
    const phoneRaw = String(phone || body.remoteJid || body.whatsapp || "").replace(/\D/g, "");
    
    // Se for Agendamento (Category: booking ou prefixo [AGENDA])
    if (category === "booking" || (subject && String(subject).includes("[AGENDA]")) || action === "booking") {
      const envInput = environment_name || body.sala || body.ambiente || pick("p_room_name") || (subject ? subject.split("-")[0].replace("[AGENDA]", "").trim() : "");
      let env = await findEnvironmentFlexibly(envInput);

      // Auto-criação de ambiente se não existir (na tabela correta: ambientes)
      if (!env && envInput) {
        const { data: newEnv } = await supabase
          .from('ambientes')
          .insert({ name: envInput.charAt(0).toUpperCase() + envInput.slice(1) })
          .select().single();
        env = newEnv;
      }

      if (env) {
        const startISO = normalizeDateTime(dateInput, startTimeInput);
        if (startISO) {
          const endISO = normalizeDateTime(dateInput, endTimeInput) || new Date(startISO.getTime() + 3600000);
          
          const { data: booking, error } = await supabase.from("reservas").insert({
            environment_id: env.id,
            requester_name: name || "WhatsApp User",
            requester_phone: phoneRaw,
            start_time: startISO.toISOString(),
            end_time: endISO.toISOString(),
            description: description || body.message || subject || "Agendamento via WhatsApp",
            status: "confirmed"
          }).select().single();

          if (error) throw error;
          return json({ ok: true, message: "Reserva confirmada", booking_id: booking?.id });
        }
      }
    }

    // Fluxo Padrão: Criar Ticket (Chamado)
    const { data: contact } = await supabase.from("contacts")
      .upsert({ phone: phoneRaw, name: name || "Novo Contato" }, { onConflict: "phone" })
      .select().single();

    if (contact) {
      const { data: ticket } = await supabase.from("tickets").insert({
        contact_id: contact.id,
        subject: subject || "Novo Chamado via WhatsApp",
        description: description || body.message || "Sem descrição",
        status: "open",
        category: category || "general",
        priority: "medium"
      }).select().single();

      return json({ ok: true, ticket_id: ticket?.id });
    }

    return json({ error: "Não foi possível processar o pedido. Verifique os dados enviados." }, 400);

  } catch (e: any) {
    console.error("Typebot Webhook Error:", e.message);
    return json({ error: e.message }, 500);
  }
});