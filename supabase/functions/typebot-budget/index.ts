import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Endpoint público para o Typebot enviar pedidos de orçamento.
 * POST JSON:
 * {
 *   "name": "Fulano",
 *   "phone": "5591999999999",
 *   "email": "fulano@x.com",
 *   "sector": "Pedagógico",
 *   "item": "Notebook Dell i5",
 *   "quantity": 2,
 *   "supplier": "Kabum",
 *   "estimated_value": 5400,
 *   "justification": "Substituir equipamento queimado"
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "typebot-budget alive" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("typebot-budget RAW", JSON.stringify(body));

    const pick = (...keys: string[]) => {
      for (const k of keys) {
        for (const bk of Object.keys(body)) {
          if (bk.toLowerCase() === k.toLowerCase()) {
            const v = body[bk];
            if (v !== undefined && v !== null && String(v).trim() !== "") return v;
          }
        }
      }
      return undefined;
    };

    const item = String(pick("item", "produto", "equipamento") ?? "").trim();
    if (!item) {
      return new Response(JSON.stringify({ error: "item é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneRaw = String(pick("phone", "telefone", "whatsapp") ?? "")
      .replace(/\D/g, "");
    const name = pick("name", "nome", "solicitante");
    const email = pick("email", "e-mail");
    const sector = pick("sector", "setor", "polo", "unidade", "bandeira");
    const supplier = pick("supplier", "fornecedor", "loja");
    const justification = pick("justification", "justificativa", "motivo");
    const quantityRaw = pick("quantity", "quantidade", "qtd");
    const valueRaw = pick("estimated_value", "valor", "preco", "preço");
    const quantity = quantityRaw ? Number(String(quantityRaw).replace(",", ".")) : 1;
    const estimated_value = valueRaw
      ? Number(String(valueRaw).replace(/[^0-9.,]/g, "").replace(",", "."))
      : null;

    let contact_id: string | null = null;
    if (phoneRaw) {
      const { data: contact } = await supabase
        .from("contacts")
        .upsert(
          { phone: phoneRaw, name: name ? String(name) : null },
          { onConflict: "phone" },
        )
        .select()
        .single();
      contact_id = contact?.id ?? null;
    }

    const { data: budget, error } = await supabase
      .from("budgets")
      .insert({
        contact_id,
        requester_name: name ? String(name) : null,
        requester_phone: phoneRaw || null,
        requester_email: email ? String(email) : null,
        requester_sector: sector ? String(sector) : null,
        item,
        quantity: isNaN(quantity) ? 1 : quantity,
        supplier: supplier ? String(supplier) : null,
        estimated_value: estimated_value && !isNaN(estimated_value) ? estimated_value : null,
        justification: justification ? String(justification) : null,
        status: "pendente",
        source: "typebot",
        metadata: body,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, budget_id: budget.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("typebot-budget error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});