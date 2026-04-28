import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { ticket_id, content } = body;
    if (!ticket_id || !content || typeof content !== "string" || content.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load ticket + contact (admin client to bypass RLS for lookup; auth was already validated)
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, contact_id, assigned_to, contacts(phone)")
      .eq("id", ticket_id)
      .maybeSingle();

    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore
    const phone: string | undefined = ticket.contacts?.phone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Contact has no phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instance = Deno.env.get("EVOLUTION_INSTANCE");
    if (!evolutionUrl || !evolutionKey || !instance) {
      return new Response(JSON.stringify({ error: "Evolution config missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evoRes = await fetch(`${evolutionUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: phone, text: content }),
    });

    const evoText = await evoText_safe(evoRes);
    if (!evoRes.ok) {
      return new Response(
        JSON.stringify({ error: "Evolution send failed", detail: evoText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist outbound message
    await admin.from("messages").insert({
      ticket_id,
      contact_id: ticket.contact_id,
      direction: "outbound",
      content,
      message_type: "text",
    });

    await admin.from("ticket_activity").insert({
      ticket_id,
      actor_id: userData.user.id,
      action: "message_sent",
      to_value: content.substring(0, 200),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function evoText_safe(r: Response): Promise<string> {
  try { return await r.text(); } catch { return ""; }
}