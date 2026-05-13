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

    // 2. Formatar datas (Normalização robusta)
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
      .from("bookings")
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
      .from("bookings")
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
