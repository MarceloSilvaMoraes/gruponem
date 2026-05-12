import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { environment_name, date, start_time, end_time } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Normalização Universal de Data e Hora
    const normalizeDateTime = (dStr: string, tStr: string) => {
      if (!dStr || !tStr) return null;
      let datePart = dStr.trim().replace(/\//g, '-');
      if (datePart.match(/^\d{1,2}-\d{1,2}$/)) {
        datePart = `${new Date().getFullYear()}-${datePart.split('-')[1].padStart(2, '0')}-${datePart.split('-')[0].padStart(2, '0')}`;
      } else if (datePart.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const [d, m, y] = datePart.split('-');
        datePart = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      let timePart = tStr.trim().toLowerCase().replace('h', ':').replace(' ', '');
      if (!timePart.includes(':')) timePart += ':00';
      const parts = timePart.split(':');
      const h = parts[0].padStart(2, '0');
      const m = (parts[1] || '00').padEnd(2, '0').substring(0, 2);
      timePart = `${h}:${m}:00`;
      try {
        const finalDate = new Date(`${datePart}T${timePart}`);
        return isNaN(finalDate.getTime()) ? null : finalDate;
      } catch { return null; }
    };

    const startReq = normalizeDateTime(date, start_time);
    const endReq = normalizeDateTime(date, end_time);

    if (!startReq || !endReq) {
      return new Response(JSON.stringify({ esta_disponivel: false, error: "Formato de data inválido" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const requestStart = startReq.getTime();
    const requestEnd = endReq.getTime();

    // 2. Busca ultra-flexível do ambiente
    // Removemos zeros à esquerda e espaços para comparar (ex: "Sala 01" vira "sala1")
    const cleanName = environment_name.toLowerCase().replace(/\s/g, '').replace(/0(?=\d)/g, '');
    
    const { data: allEnvs } = await supabase.from('environments').select('id, name');
    const env = allEnvs?.find(e => {
      const dbCleanName = e.name.toLowerCase().replace(/\s/g, '').replace(/0(?=\d)/g, '');
      return dbCleanName === cleanName || e.name.toLowerCase().includes(environment_name.toLowerCase());
    });

    // Se o ambiente não existe no sistema, tecnicamente ele está "disponível" para o bot continuar
    if (!env) {
      return new Response(JSON.stringify({ 
        esta_disponivel: true, 
        message: "Ambiente novo ou não localizado, prosseguindo..." 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Buscar agendamentos
    const { data: dbBookings } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('environment_id', env.id)
      .neq('status', 'cancelled');

    let conflictFound = false;
    dbBookings?.forEach((b: any) => {
      const start = new Date(b.start_time).getTime();
      const end = new Date(b.end_time).getTime();
      if (start < requestEnd && end > requestStart) conflictFound = true;
    });

    return new Response(
      JSON.stringify({ 
        esta_disponivel: !conflictFound,
        message: conflictFound ? "Horário ocupado" : "Horário disponível"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ esta_disponivel: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
