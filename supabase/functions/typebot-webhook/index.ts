import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Endpoint público para o Typebot.
 * POST JSON esperado:
 * {
 *   "phone": "5511999999999",            // obrigatório (somente dígitos, com DDI)
 *   "name": "João da Silva",              // opcional
 *   "keyword": "suporte01",               // opcional, palavra-chave que originou o fluxo
 *   "subject": "Sem acesso ao ERP",       // opcional, vira título
 *   "description": "Texto detalhado...",  // obrigatório, vira descrição do chamado
 *   "category": "suporte",                // opcional
 *   "priority": "medium"                  // opcional: low | medium | high | urgent
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "Typebot webhook is running" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => null);
    if (!body) {
      return json({ error: "Invalid JSON" }, 400);
    }

    const phoneRaw = String(body.phone ?? "").replace(/\D/g, "");
    const description = String(body.description ?? "").trim();

    if (!phoneRaw || !description) {
      return json({ error: "phone and description are required" }, 400);
    }

    const name = body.name ? String(body.name) : null;
    const keyword = body.keyword ? String(body.keyword).toLowerCase().trim() : null;
    const subject =
      (body.subject && String(body.subject).slice(0, 120)) ||
      description.slice(0, 60) + (description.length > 60 ? "..." : "");
    const category = body.category ? String(body.category) : keyword ?? "geral";
    const allowedPriorities = ["low", "medium", "high", "urgent"] as const;
    const priority = allowedPriorities.includes(body.priority) ? body.priority : "medium";

    // 1. Upsert contact
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .upsert({ phone: phoneRaw, name }, { onConflict: "phone" })
      .select()
      .single();
    if (contactErr || !contact) throw contactErr ?? new Error("contact upsert failed");

    // 2. Reuse existing open ticket OR create a new one
    let { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("contact_id", contact.id)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ticket) {
      // update with the new description so attendant sees the latest detail
      await supabase
        .from("tickets")
        .update({
          subject,
          description,
          category,
          priority,
          source: "typebot",
          trigger_keyword: keyword,
          ai_summary: description.slice(0, 240),
        })
        .eq("id", ticket.id);
    } else {
      const { data: newTicket, error: tErr } = await supabase
        .from("tickets")
        .insert({
          contact_id: contact.id,
          subject,
          description,
          category,
          priority,
          source: "typebot",
          trigger_keyword: keyword,
          ai_summary: description.slice(0, 240),
          status: "open",
        })
        .select()
        .single();
      if (tErr) throw tErr;
      ticket = newTicket;
    }

    // 3. Save message log of the typebot submission
    await supabase.from("messages").insert({
      ticket_id: ticket!.id,
      contact_id: contact.id,
      direction: "inbound",
      content: `[Typebot${keyword ? ` • ${keyword}` : ""}]\n${description}`,
      message_type: "text",
    });

    return json({ ok: true, ticket_id: ticket!.id, contact_id: contact.id });
  } catch (err) {
    console.error("typebot-webhook error", err);
    return json({ error: err instanceof Error ? err.message : "unknown" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}