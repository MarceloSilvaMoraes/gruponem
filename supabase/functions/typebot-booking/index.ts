import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // GET: Retorna a lista de ambientes para o Typebot usar como opções
  if (req.method === "GET") {
    const { data: envs, error } = await supabase.from("environments").select("id, name").order("name");
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    
    return new Response(JSON.stringify(envs), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("Booking Request:", body);

    const pick = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
        const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
      }
      return null;
    };

    const name = pick(body, "name", "nome");
    const phone = String(pick(body, "phone", "whatsapp", "remoteJid") || "").replace(/\D/g, "");
    const envSearch = pick(body, "environment", "ambiente", "sala", "local");
    const date = pick(body, "date", "data", "data_agendamento");
    const startTime = pick(body, "start_time", "inicio", "hora_inicio", "horario_inicio");
    const endTime = pick(body, "end_time", "fim", "hora_fim", "horario_fim");
    const description = pick(body, "description", "evento", "motivo", "motivo_agendamento");

    if (!envSearch || !date || !startTime) {
      return new Response(JSON.stringify({ error: "Dados insuficientes (ambiente, data e início são obrigatórios)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Localizar o ambiente pelo nome
    const { data: env } = await supabase
      .from("environments")
      .select("id, name")
      .ilike("name", `%${envSearch}%`)
      .single();

    if (!env) {
      return new Response(JSON.stringify({ error: `Ambiente '${envSearch}' não encontrado` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Formatar datas (Normalização robusta com suporte a PT-BR)
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
        const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
        const targetDay = days.findIndex(d => dLower.includes(d));
        if (targetDay !== -1) {
          const targetDate = new Date();
          let diff = targetDay - now.getDay();
          if (diff <= 0) diff += 7;
          targetDate.setDate(now.getDate() + diff);
          datePart = targetDate.toISOString().split('T')[0];
        }
      }

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

    const start = normalizeDateTime(date, startTime);
    const end = normalizeDateTime(date, endTime) || (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);

    if (!start || !end) {
      console.error("Invalid Date/Time:", { date, startTime, endTime });
      return new Response(JSON.stringify({ error: "Formato de data ou hora inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verificar sobreposição (Overlap Check)
    const { data: existing, error: checkError } = await supabase
      .from("reservas")
      .select("id")
      .eq("environment_id", env.id)
      .neq("status", "cancelled")
      .filter("start_time", "lt", end.toISOString())
      .filter("end_time", "gt", start.toISOString());

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ 
        error: `O ambiente ${env.name} já está ocupado neste horário solicitado.` 
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Salvar agendamento
    const { data: booking, error } = await supabase
      .from("reservas")
      .insert({
        environment_id: env.id,
        requester_name: name || "WhatsApp User",
        requester_phone: phone,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        description: description || "Agendamento via WhatsApp",
        status: "confirmed"
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, booking }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Booking Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
