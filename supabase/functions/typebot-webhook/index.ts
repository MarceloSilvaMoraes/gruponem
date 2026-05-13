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
    console.log("Webhook Body:", body);

    // Mapeamento flexível de campos do Typebot
    const pick = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
        const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
      }
      return null;
    };

    const action = pick(body, "action", "event");
    const envInput = pick(body, "environment_name", "sala", "ambiente", "local", "environment");
    const dateInput = pick(body, "date", "data", "data_agendamento");
    const startTimeInput = pick(body, "start_time", "inicio", "hora_inicio", "horario_inicio");
    const endTimeInput = pick(body, "end_time", "fim", "hora_fim", "horario_fim");
    const category = pick(body, "category", "categoria");
    const name = pick(body, "name", "nome");
    const phone = pick(body, "phone", "whatsapp", "remoteJid");
    const subject = pick(body, "subject", "assunto");
    const description = pick(body, "description", "descricao", "motivo", "motivo_agendamento", "evento");

    // Função Universal de Normalização de Data/Hora
    const normalizeDateTime = (dStr: string, tStr: string) => {
      if (!dStr || !tStr) return null;
      let datePart = String(dStr).trim().replace(/\//g, '-');
      
      // Lidar com dd-mm-yyyy ou dd-mm
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

      if (!startReq) return json({ available: false, esta_disponivel: false, message: "Data ou hora inválida" });

      const env = await findEnvironmentFlexibly(envInput);
      if (!env) return json({ available: true, esta_disponivel: true, message: "Sala nova ou não encontrada" });

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
        esta_disponivel: !conflict, 
        message: conflict ? "Ocupado" : "Livre" 
      });
    }

    // ========= MODO: INSERT (Criação de Agendamento ou Ticket) =========
    const phoneRaw = String(phone || body.remoteJid || "").replace(/\D/g, "");
    
    // Se for Agendamento (Category: booking ou se tiver dados de ambiente e data)
    const isBooking = category === "booking" || 
                     (subject && String(subject).includes("[AGENDA]")) || 
                     (envInput && dateInput && startTimeInput);

    if (isBooking) {
      let env = await findEnvironmentFlexibly(envInput || (subject ? subject.split("-")[0].replace("[AGENDA]", "").trim() : ""));

      if (!env && envInput) {
        // Criar ambiente se não existir
        const { data: newEnv } = await supabase
          .from('environments')
          .insert({ name: String(envInput).charAt(0).toUpperCase() + String(envInput).slice(1) })
          .select().single();
        env = newEnv;
      }

      if (env) {
        const startISO = normalizeDateTime(dateInput, startTimeInput);
        if (startISO) {
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
            return json({ ok: true, message: "Reserva confirmada", booking_id: booking.id });
          } else {
            console.error("Error creating booking:", bErr);
          }
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
        subject: subject || (envInput ? `[AGENDA] ${envInput} - ${description || "Reserva"}` : "Novo Chamado via WhatsApp"),
        description: description || body.message || subject || "Sem descrição",
        status: "open",
        category: category || (isBooking ? "booking" : "general"),
        priority: "medium"
      }).select().single();

      return json({ ok: true, ticket_id: ticket?.id, message: "Ticket criado" });
    }

    return json({ error: "Não foi possível processar a solicitação" }, 400);

  } catch (e: any) {
    console.error("Webhook Error:", e);
    return json({ error: e.message }, 500);
  }
});

  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});