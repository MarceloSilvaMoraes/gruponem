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
        if (obj[k]) return obj[k];
        const found = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
      }
      return null;
    };

    const name = pick(body, "name", "nome");
    const phone = String(pick(body, "phone", "whatsapp", "remoteJid") || "").replace(/\D/g, "");
    const envSearch = pick(body, "environment", "ambiente", "sala", "local");
    const date = pick(body, "date", "data");
    const startTime = pick(body, "start_time", "inicio", "hora_inicio");
    const endTime = pick(body, "end_time", "fim", "hora_fim");
    const description = pick(body, "description", "evento", "motivo");

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

    // 2. Formatar datas
    // Tenta lidar com formatos dd/mm/yyyy ou yyyy-mm-dd
    let formattedDate = date;
    if (date.includes("/")) {
      const [d, m, y] = date.split("/");
      formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const formatTime = (t: string) => {
      let cleaned = t.toLowerCase().replace("h", ":");
      if (!cleaned.includes(":")) cleaned += ":00";
      const [h, m] = cleaned.split(":");
      return `${h.padStart(2, '0')}:${(m || "00").padStart(2, '0')}`;
    };

    const startStr = `${formattedDate}T${formatTime(startTime)}`;
    const start = new Date(startStr);
    
    let end = endTime 
      ? new Date(`${formattedDate}T${formatTime(endTime)}`) 
      : new Date(start.getTime() + 60 * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error("Invalid Date/Time:", { date, startTime, endTime, startStr });
      return new Response(JSON.stringify({ error: "Formato de data ou hora inválido. Use AAAA-MM-DD e HH:MM" }), {
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
        requester_name: name || "Desconhecido",
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
