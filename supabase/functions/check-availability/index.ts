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

    // 1. Converter horários de entrada para números (ex: "08:30" -> 8.5)
    const parseTimeToNumber = (timeStr: string) => {
      const [h, m] = timeStr.replace('h', ':').split(':').map(Number)
      return h + (m || 0) / 60
    }

    const newStart = parseTimeToNumber(start_time)
    const newEnd = parseTimeToNumber(end_time)

    // 2. Buscar agendamentos existentes para essa sala e dia
    // Buscamos na tabela de tickets (onde estão a maioria por enquanto)
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('subject')
      .or(`category.eq.booking,subject.ilike.[AGENDA]%`)
      .ilike('subject', `%${environment_name}%`)
      .ilike('subject', `%${date}%`)

    if (error) throw error

    let conflictFound = false
    let conflictingEvent = ""

    tickets?.forEach((t: any) => {
      // Tenta extrair o intervalo do título: "14:00 às 16:00" ou "14h - 16h"
      const rangeMatch = t.subject.match(/(\d{1,2}[:h]\d{2}|\d{1,2}h)\s*(?:as|às|-|to)\s*(\d{1,2}[:h]\d{2}|\d{1,2}h)/i)
      const singleMatch = t.subject.match(/(\d{1,2}[:h]\d{2})|(\d{1,2}h)/i)

      let existingStart = 0
      let existingEnd = 0

      if (rangeMatch) {
        existingStart = parseTimeToNumber(rangeMatch[1])
        existingEnd = parseTimeToNumber(rangeMatch[2])
      } else if (singleMatch) {
        existingStart = parseTimeToNumber(singleMatch[0])
        existingEnd = existingStart + 1 // Assume 1h se não tiver fim
      }

      // Lógica de Sobreposição: (Início1 < Fim2) E (Fim1 > Início2)
      if (existingStart < newEnd && existingEnd > newStart) {
        conflictFound = true
        conflictingEvent = t.subject
      }
    })

    return new Response(
      JSON.stringify({ 
        available: !conflictFound, 
        conflict: conflictFound ? conflictingEvent : null,
        message: conflictFound ? "Horário ocupado" : "Horário disponível"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
