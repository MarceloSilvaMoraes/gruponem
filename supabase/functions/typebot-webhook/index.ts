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
    console.log("Webhook Body:", JSON.stringify(body));

    // Mapeamento flexível de campos do Typebot (Combina nomes locais e remotos)
    const pick = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
        const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
      }
      return null;
    };

    const action = pick(body, "action", "event", "tipo");
    const envInput = pick(body, "environment_name", "sala", "ambiente", "local", "environment", "p_room_name");
    const dateInput = pick(body, "date", "data", "data_agendamento", "p_date");
    const startTimeInput = pick(body, "start_time", "inicio", "hora_inicio", "horario_inicio", "p_start");
    const endTimeInput = pick(body, "end_time", "fim", "hora_fim", "horario_fim", "p_end");
    const category = pick(body, "category", "categoria");
    const name = pick(body, "name", "nome", "p_name", "user_name");
    const phone = pick(body, "phone", "whatsapp", "remoteJid", "p_phone");
    const subject = pick(body, "subject", "assunto", "p_subject");
    const description = pick(body, "description", "descricao", "motivo", "motivo_agendamento", "evento", "message", "p_message", "p_desc");

    // Função Universal de Normalização de Data/Hora com Suporte a Linguagem Natural (PT-BR)
    const normalizeDateTime = (dStr: string, tStr: string) => {
      if (!dStr || !tStr) return null;
      
      const now = new Date();
      let datePart = "";
      const dLower = String(dStr).toLowerCase().trim();

      // Suporte a termos relativos
      if (dLower === "hoje") {
        datePart = now.toISOString().split('T')[0];
      } else if (dLower === "amanhã" || dLower === "amanha") {
        const tomorrow = new Date();
        tomorrow.setDate(now.getDate() + 1);
        datePart = tomorrow.toISOString().split('T')[0];
      } else if (dLower === "depois de amanhã" || dLower === "depois de amanha") {
        const afterTomorrow = new Date();
        afterTomorrow.setDate(now.getDate() + 2);
        datePart = afterTomorrow.toISOString().split('T')[0];
      } else if (dLower.match(/segunda|terça|quarta|quinta|sexta|sábado|domingo/)) {
        // Encontrar o próximo dia da semana mencionado
        const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
        const targetDay = days.findIndex(d => dLower.includes(d));
        if (targetDay !== -1) {
          const targetDate = new Date();
          let diff = targetDay - now.getDay();
          if (diff <= 0) diff += 7; // Próxima semana
          targetDate.setDate(now.getDate() + diff);
          datePart = targetDate.toISOString().split('T')[0];
        }
      }

      // Se não foi resolvido por termos relativos, tenta os formatos numéricos
      if (!datePart) {
        let cleaned = dLower.replace(/\//g, '-');
        if (cleaned.match(/^\d{1,2}-\d{1,2}$/)) {
          datePart = `${now.getFullYear()}-${cleaned.split('-')[1].padStart(2, '0')}-${cleaned.split('-')[0].padStart(2, '0')}`;
        } else if (cleaned.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
          const [d, m, y] = cleaned.split('-');
          datePart = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else if (cleaned.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          datePart = cleaned;
        }
      }

      if (!datePart) return null;
      
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
      const cleanInput = String(nameInput).toLowerCase().replace(/\s/g, '').replace(/0(?=\d)/g, '');
      const { data: allEnvs } = await supabase.from('environments').select('id, name');
      return allEnvs?.find(e => {
        const dbClean = e.name.toLowerCase().replace(/\s/g, '').replace(/0(?=\d)/g, '');
        return dbClean === cleanInput || e.name.toLowerCase().includes(String(nameInput).toLowerCase());
      });
    };

    // ========= MODO: CHECK (Verificação de Disponibilidade) =========
    if (action === "check" || action === "check_availability") {
      const startReq = normalizeDateTime(dateInput, startTimeInput);
      const endReq = normalizeDateTime(dateInput, endTimeInput || (startTimeInput ? `${parseInt(startTimeInput)+1}:00` : ""));

      if (!startReq) return json({ available: false, esta_disponivel: "ERRO", message: "Data ou hora inválida" });

      const env = await findEnvironmentFlexibly(envInput);
      if (!env) return json({ available: true, esta_disponivel: "LIBERADO", message: "Sala nova ou não encontrada" });

      const { data: bookings } = await supabase
        .from('bookings')
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
        esta_disponivel: !conflict ? "LIBERADO" : "OCUPADO", 
        message: conflict ? "Ocupado" : "Livre",
        data: { esta_disponivel: !conflict ? "LIBERADO" : "OCUPADO" }
      });
    }

    // ========= MODO: INSERT (Criação de Agendamento ou Ticket) =========
    const phoneRaw = String(phone || body.remoteJid || "").replace(/\D/g, "");
    
    const isBookingRequest = action === "booking" || category === "booking";
    const hasBookingData = envInput && dateInput && startTimeInput;

    const debug_info = {
      received_action: action,
      received_env: envInput,
      received_date: dateInput,
      received_start: startTimeInput,
      is_booking_request: isBookingRequest,
      has_booking_data: hasBookingData,
      version: "5.0"
    };

    if (isBookingRequest || hasBookingData) {
      console.log("Processing Booking Request:", debug_info);
      
      let env = await findEnvironmentFlexibly(envInput || (subject ? subject.split("-")[0].replace("[AGENDA]", "").trim() : ""));

      if (!env && envInput) {
        const { data: newEnv } = await supabase
          .from('environments')
          .insert({ name: String(envInput).charAt(0).toUpperCase() + String(envInput).slice(1) })
          .select().single();
        env = newEnv;
      }

      if (!env) {
        return json({ 
          error: "Ambiente não identificado.", 
          debug_info, 
          esta_disponivel: "ERRO" 
        }, 400);
      }

      const startISO = normalizeDateTime(dateInput, startTimeInput);
      if (!startISO) {
        return json({ 
          error: "Data ou hora inválida.", 
          debug_info, 
          esta_disponivel: "ERRO" 
        }, 400);
      }

      const endISO = normalizeDateTime(dateInput, endTimeInput) || new Date(startISO.getTime() + 3600000);
      
      const { data: booking, error: bErr } = await supabase.from("bookings").insert({
        environment_id: env.id,
        requester_name: name || "WhatsApp User",
        requester_phone: phoneRaw,
        start_time: startISO.toISOString(),
        end_time: endISO.toISOString(),
        description: description || subject || `Reserva de ${env.name}`,
        status: "confirmed"
      }).select().single();

      if (!bErr) {
        return json({ 
          ok: true, 
          message: "Reserva confirmada!", 
          booking_id: booking.id,
          debug_info,
          esta_disponivel: "LIBERADO",
          data: { esta_disponivel: "LIBERADO" }
        });
      } else {
        return json({ error: bErr.message, debug_info, esta_disponivel: "ERRO" }, 500);
      }
    }

    // Fluxo Padrão: Criar Ticket (Chamado)
    // Se action for "booking" mas chegou aqui, é porque algo falhou acima.
    if (isBookingRequest) {
      return json({ error: "Falha ao processar reserva estruturada.", debug_info }, 400);
    }

    const { data: contact } = await supabase.from("contacts")
      .upsert({ phone: phoneRaw, name: name || "Novo Contato" }, { onConflict: "phone" })
      .select().single();

    if (contact) {
      const finalSubject = subject || `Novo Chamado - ${envInput || "Geral"}`;

      const { data: ticket } = await supabase.from("tickets").insert({
        contact_id: contact.id,
        subject: finalSubject,
        description: description || body.message || subject || "Sem descrição",
        status: "open",
        category: category || "general"
      }).select().single();

      return json({ 
        ok: true, 
        ticket_id: ticket?.id, 
        message: "Ticket criado",
        debug_info,
        esta_disponivel: "LIBERADO"
      });
    }

    return json({ error: "Erro desconhecido", debug_info }, 400);

  } catch (e: any) {
    console.error("Webhook Error:", e);
    return json({ error: e.message, version: "5.0" }, 500);
  }
});