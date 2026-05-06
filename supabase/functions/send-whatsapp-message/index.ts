import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const { ticket_id, content, internal_only } = body;
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
    const rawPhone: string | undefined = ticket.contacts?.phone;
    let evoDetail: string | null = null;
    let sentToWhatsapp = false;

    if (!internal_only) {
      // Normalize phone: WhatsApp ids may look like "5591999999999-1603121921@g.us"
      const numericPart = String(rawPhone ?? "").split(/[-@]/)[0].replace(/\D/g, "");

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const instance = Deno.env.get("EVOLUTION_INSTANCE");

      if (!numericPart) {
        evoDetail = "contato_sem_telefone";
      } else if (!evolutionUrl || !evolutionKey || !instance) {
        evoDetail = "evolution_config_ausente";
      } else {
        try {
          const evoRes = await fetch(
            `${evolutionUrl.replace(/\/$/, "")}/message/sendText/${instance}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evolutionKey },
              body: JSON.stringify({ number: numericPart, text: content }),
            },
          );
          const evoText = await evoText_safe(evoRes);
          console.log("evolution response", evoRes.status, evoText);
          if (!evoRes.ok) {
            evoDetail = `evolution_${evoRes.status}: ${evoText.substring(0, 300)}`;
          } else {
            sentToWhatsapp = true;
          }
        } catch (e) {
          evoDetail = `evolution_fetch_error: ${String(e).substring(0, 300)}`;
        }
      }
    }

    // Persist outbound message even if Evolution failed — keeps team's record.
    const persisted = sentToWhatsapp || internal_only ? content : `${content}\n\n[⚠ não enviado ao WhatsApp: ${evoDetail}]`;
    await admin.from("messages").insert({
      ticket_id,
      contact_id: ticket.contact_id,
      direction: "outbound",
      content: persisted,
      message_type: "text",
      sender_label: internal_only ? "internal" : sentToWhatsapp ? "agent" : "agent_failed",
    });

    await admin.from("ticket_activity").insert({
      ticket_id,
      actor_id: userData.user.id,
      action: "message_sent",
      to_value: content.substring(0, 200),
    });

    return new Response(JSON.stringify({ ok: true, sentToWhatsapp, evoDetail }), {
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