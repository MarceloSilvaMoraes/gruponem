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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    console.log("Webhook received:", JSON.stringify(body));

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

    const phone = messageData.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
    const pushName = messageData.pushName || null;
    const messageContent = messageData.message?.conversation 
      || messageData.message?.extendedTextMessage?.text 
      || messageData.message?.imageMessage?.caption
      || "[mídia]";
    const whatsappMessageId = messageData.key?.id || null;

    // 1. Upsert contact
    const { data: contact } = await supabase
      .from("contacts")
      .upsert({ phone, name: pushName }, { onConflict: "phone" })
      .select()
      .single();

    if (!contact) {
      throw new Error("Failed to upsert contact");
    }

    // 2. Find open ticket or create new one
    let { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("contact_id", contact.id)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let isNewTicket = false;

    if (!ticket) {
      isNewTicket = true;

      // Use AI to classify the message and generate subject
      let aiSubject = "Novo atendimento";
      let aiCategory = "geral";
      let aiPriority: "low" | "medium" | "high" | "urgent" = "medium";
      let aiSummary = messageContent;

      if (LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `Você é um assistente de classificação de tickets de suporte via WhatsApp.
Analise a mensagem do cliente e retorne um JSON com:
- subject: título curto do ticket (máx 60 chars)
- category: categoria (vendas, suporte, financeiro, reclamação, informação, geral)
- priority: prioridade (low, medium, high, urgent)
- summary: resumo da solicitação em 1-2 frases
- reply: resposta automática educada para o cliente, confirmando que recebeu a mensagem e vai atendê-lo`,
                },
                { role: "user", content: messageContent },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "classify_ticket",
                    description: "Classifica a mensagem e gera resposta",
                    parameters: {
                      type: "object",
                      properties: {
                        subject: { type: "string" },
                        category: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                        summary: { type: "string" },
                        reply: { type: "string" },
                      },
                      required: ["subject", "category", "priority", "summary", "reply"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "classify_ticket" } },
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const args = JSON.parse(toolCall.function.arguments);
              aiSubject = args.subject || aiSubject;
              aiCategory = args.category || aiCategory;
              aiPriority = args.priority || aiPriority;
              aiSummary = args.summary || aiSummary;

              // Send AI reply back via Evolution API
              const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
              const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
              const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE");

              if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE && args.reply) {
                await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: EVOLUTION_API_KEY,
                  },
                  body: JSON.stringify({
                    number: phone,
                    text: args.reply,
                  }),
                });
              }
            }
          }
        } catch (aiError) {
          console.error("AI classification error:", aiError);
        }
      }

      const { data: newTicket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          contact_id: contact.id,
          subject: aiSubject,
          category: aiCategory,
          priority: aiPriority,
          ai_summary: aiSummary,
          status: "open",
        })
        .select()
        .single();

      if (ticketError) throw ticketError;
      ticket = newTicket;
    }

    // 3. Save the message
    await supabase.from("messages").insert({
      ticket_id: ticket.id,
      contact_id: contact.id,
      direction: "inbound",
      content: messageContent,
      message_type: "text",
      whatsapp_message_id: whatsappMessageId,
    });

    return new Response(
      JSON.stringify({ ok: true, ticket_id: ticket.id, is_new: isNewTicket }),
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
