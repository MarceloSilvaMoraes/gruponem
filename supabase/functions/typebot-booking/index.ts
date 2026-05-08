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
        // Case-insensitive search
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

    // 1. Localizar o ambiente pelo nome
    const { data: env } = await supabase
      .from("environments")
      .select("id")
      .ilike("name", `%${envSearch}%`)
      .single();

    if (!env) {
      return new Response(JSON.stringify({ error: "Ambiente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Formatar datas (Exemplo simples, assumindo ISO ou strings compatíveis)
    const start = new Date(`${date} ${startTime}`);
    const end = endTime ? new Date(`${date} ${endTime}`) : new Date(start.getTime() + 60 * 60 * 1000); // +1h se não informado

    // 3. Salvar agendamento
    const { data: booking, error } = await supabase
      .from("bookings")
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
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
