import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check for GET requests (browser access)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "WhatsApp webhook is running" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid or empty JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Evolution API webhook payload structure
    const event = body.event;
    
    // Handle only incoming messages
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid = messageData.key?.remoteJid || "";
    const phoneJid = messageData.key?.remoteJidAlt || remoteJid;
    const phone = String(phoneJid).replace(/\D/g, "");
    const pushName = messageData.pushName || null;
    const messageContent = messageData.message?.conversation 
      || messageData.message?.extendedTextMessage?.text 
      || messageData.message?.imageMessage?.caption
      || "[mídia]";

    // Ignore group messages — only handle direct chats
    if (remoteJid.endsWith("@g.us")) {
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if message matches a configured trigger keyword.
    // ONLY trigger keywords cause any action here — everything else is ignored.
    // The Typebot flow collects the description and POSTs to typebot-webhook,
    // which is responsible for creating the ticket.
    const normalized = messageContent.trim().toLowerCase();
    const { data: triggers } = await supabase
      .from("trigger_keywords")
      .select("keyword")
      .eq("active", true);
    const matchedTrigger = triggers?.find((t) => t.keyword.toLowerCase() === normalized);

    if (!matchedTrigger) {
      // Ignore everything that is not an explicit trigger.
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_trigger" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phone) {
      return new Response(JSON.stringify({ ok: true, skipped: "missing_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert contact only when a trigger fires (so we have it ready for the Typebot callback)
    await supabase
      .from("contacts")
      .upsert({ phone, name: pushName }, { onConflict: "phone" });

    console.log("Trigger matched, handing off to Typebot:", matchedTrigger.keyword);
    return new Response(
      JSON.stringify({ ok: true, trigger: matchedTrigger.keyword, handoff: "typebot" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
