import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Endpoint público para o Typebot.
 * POST JSON esperado.
 *
 * Suporta DOIS modos:
 *
 * 1) Modo "abertura de chamado" (modo legado):
 * {
 *   "phone": "5511999999999",            // opcional (somente dígitos, com DDI)
 *   "name": "João da Silva",              // opcional; também aceita nome/Nome
 *   "keyword": "suporte01",               // opcional, palavra-chave que originou o fluxo
 *   "subject": "Sem acesso ao ERP",       // opcional, vira título
 *   "description": "Texto detalhado...",  // obrigatório; também aceita pergunta/Pergunta/mensagem
 *   "category": "suporte",                // opcional
 *   "priority": "medium"                  // opcional: low | medium | high | urgent
 * }
 *
 * 2) Modo "evento de fluxo" (recomendado para registrar TODA a jornada):
 *    {
 *      "phone": "5511999999999",          // ou ticket_id direto
 *      "ticket_id": "uuid",               // opcional, se já souber
 *      "event": "flow_started" | "flow_step" | "flow_ended" | "nps",
 *      "name": "...", "sector": "...",    // identificação (no flow_started)
 *      "step": "Etapa 2 — categoria",     // descritivo da etapa (flow_step)
 *      "question": "Qual o problema?",    // opcional (flow_step)
 *      "answer": "Internet caiu",         // resposta do usuário (flow_step)
 *      "message": "Texto livre do bot",   // opcional (qualquer evento)
 *      "score": 5,                        // 1..5 (event=nps)
 *      "comment": "Atendimento ótimo"     // opcional (event=nps)
 *    }
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

    // ========= MODO NOVO: Checagem de Disponibilidade (Agenda Real) =========
    if (body.action === "check" || body.event === "check_availability") {
      const envSearch = body.environment_name || body.sala || body.ambiente || body.local;
      const date = body.date || body.data;
      const startTime = body.start_time || body.inicio;
      const endTime = body.end_time || body.fim;

      if (!envSearch || !date || !startTime) {
        return json({ error: "Dados insuficientes (ambiente, data e início são necessários)" }, 400);
      }

      // 1. Achar o ambiente
      const { data: env } = await supabase
        .from("environments")
        .select("id, name")
        .ilike("name", `%${envSearch}%`)
        .single();

      if (!env) {
        // Retorna lista de ambientes disponíveis para ajudar o usuário
        const { data: allEnvs } = await supabase.from("environments").select("name").limit(5);
        const options = allEnvs?.map(e => e.name).join(", ") || "Nenhum ambiente cadastrado";
        return json({ 
          available: false, 
          ok: false, 
          message: `Ambiente '${envSearch}' não encontrado. Disponíveis: ${options}` 
        });
      }

      // 2. Formatar horários para comparação
      const formatTime = (t: string) => {
        let cleaned = t.toLowerCase().replace("h", ":");
        if (!cleaned.includes(":")) cleaned += ":00";
        const [h, m] = cleaned.split(":");
        return `${h.padStart(2, '0')}:${(m || "00").padStart(2, '0')}`;
      };

      const formattedDate = date.includes("/") 
        ? date.split("/").reverse().join("-") 
        : date;

      const startISO = new Date(`${formattedDate}T${formatTime(startTime)}`).toISOString();
      const endISO = endTime 
        ? new Date(`${formattedDate}T${formatTime(endTime)}`).toISOString()
        : new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();

      // 3. Verificar conflitos na tabela de BOOKINGS
      const { data: conflicts } = await supabase
        .from("bookings")
        .select("id")
        .eq("environment_id", env.id)
        .neq("status", "cancelled")
        .filter("start_time", "lt", endISO)
        .filter("end_time", "gt", startISO);

      const isAvailable = !conflicts || conflicts.length === 0;

      return json({ 
        available: isAvailable, 
        ok: isAvailable,
        environment_id: env.id,
        message: isAvailable ? "Horário disponível" : "Horário já ocupado" 
      });
    }

    // Log the RAW body so we can see exactly what Typebot is sending
    console.log("Typebot RAW body:", JSON.stringify(body));

    // Case-insensitive field lookup helper
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        for (const bk of Object.keys(body)) {
          if (bk.toLowerCase() === k.toLowerCase()) {
            const v = body[bk];
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              return v;
            }
          }
        }
      }
      return undefined;
    };

    // ========= MODO 2: evento de fluxo / NPS =========
    const eventRaw = pick("event", "tipo", "type");
    const event = eventRaw ? String(eventRaw).toLowerCase().trim() : null;

    if (event && ["flow_started", "flow_step", "flow_ended", "nps", "bot_message", "user_message"].includes(event)) {
      return await handleFlowEvent(supabase, body, pick, event);
    }

    const nameInput = pick("name", "nome", "Nome", "username", "user_name", "cliente");
    const descriptionInput = pick(
      "description", "pergunta", "Pergunta", "question",
      "mensagem", "message", "msg", "duvida", "dúvida", "texto", "text", "problema"
    );
    const sectorInput = pick(
      "sector", "setor", "Setor", "polo", "Polo", "bandeira", "Bandeira",
      "unidade", "Unidade", "area", "área", "Area"
    );

    // Fallback: if still nothing, use the first non-empty string field that
    // isn't obviously the name/phone/keyword.
    let finalDescription = descriptionInput;
    if (!finalDescription) {
      for (const [k, v] of Object.entries(body)) {
        if (!v || typeof v !== "string") continue;
        const lk = k.toLowerCase();
        if (["name", "nome", "phone", "telefone", "keyword",
             "sector", "setor", "polo", "bandeira", "unidade", "area"].includes(lk)) continue;
        if (String(v).trim().length > 0) { finalDescription = v; break; }
      }
    }

    console.log("Typebot parsed:", JSON.stringify({
      name: nameInput,
      description: finalDescription,
      sector: sectorInput,
      fields: Object.keys(body),
    }));

    const description =
      String(finalDescription ?? "").trim() ||
      "Chamado aberto pelo fluxo do Typebot sem descrição informada.";

    const name = nameInput ? String(nameInput).trim() : null;
    const sector = sectorInput ? String(sectorInput).trim().slice(0, 80) : null;
    const phoneInput = pick("phone", "remoteJid", "whatsapp", "telefone", "userPhone");
    let phoneRaw = String(phoneInput ?? "").split(/[-@]/)[0].replace(/\D/g, "");
    
    if (!phoneRaw) {
      const slug = (name ?? "anon")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20) || "anon";
      phoneRaw = `typebot-${slug}-${Date.now()}`;
    }

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
          sector,
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
          sector,
          ai_summary: description.slice(0, 240),
          status: "open",
        })
        .select()
        .single();
      if (tErr) throw tErr;
      ticket = newTicket;
    }

    // 3. Save message log of the typebot submission.
    // Header identifies the requester: name + sector when available,
    // falling back to the keyword that triggered the flow.
    const headerParts: string[] = [];
    if (name) headerParts.push(name);
    if (sector) headerParts.push(sector);
    if (headerParts.length === 0 && keyword) headerParts.push(keyword);
    const header = headerParts.length > 0 ? headerParts.join(" • ") : "Typebot";
    await supabase.from("messages").insert({
      ticket_id: ticket!.id,
      contact_id: contact.id,
      direction: "inbound",
      content: `[${header}]\n${description}`,
      message_type: "text",
      sender_label: "user",
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

// ============================================================
// MODO 2 — eventos de fluxo do Typebot
// ============================================================
async function handleFlowEvent(
  supabase: any,
  body: any,
  pick: (...keys: string[]) => any,
  event: string,
) {
  const ticketIdInput = pick("ticket_id", "ticketId");
  const phoneInput = pick("phone", "telefone", "whatsapp");
  const nameInput = pick("name", "nome");
  const sectorInput = pick("sector", "setor", "polo", "bandeira", "unidade");
  const stepInput = pick("step", "etapa", "stage");
  const questionInput = pick("question", "pergunta");
  const answerInput = pick("answer", "resposta");
  const messageInput = pick("message", "msg", "texto", "text", "content");
  const scoreInput = pick("score", "nota", "nps");
  const commentInput = pick("comment", "comentario", "comentário");

  // 1) Localizar ou criar contato/ticket
  let ticket: any = null;
  let contactId: string | null = null;

  if (ticketIdInput) {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", String(ticketIdInput))
      .maybeSingle();
    ticket = data;
    contactId = data?.contact_id ?? null;
  }

  if (!ticket) {
    const phoneInput = pick("phone", "remoteJid", "whatsapp", "telefone", "userPhone");
    let phoneRaw = String(phoneInput ?? "").split(/[-@]/)[0].replace(/\D/g, "");
    
    if (!phoneRaw && nameInput) {
      const slug = String(nameInput)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20) || "anon";
      phoneRaw = `typebot-${slug}`;
    }
    if (phoneRaw) {
      // Tenta achar contato com variações de formato BR:
      // ex: 5591993910084, 91993910084, 993910084, 559193910084 (sem 9), etc.
      const variants = buildPhoneVariants(phoneRaw);
      let contact: any = null;
      // 1) Match exato em qualquer variação — prioriza contato que já tem ticket
      const { data: exactMatches } = await supabase
        .from("contacts")
        .select("*")
        .in("phone", variants);
      if (exactMatches && exactMatches.length > 0) {
        for (const c of exactMatches) {
          const { data: t } = await supabase
            .from("tickets")
            .select("id")
            .eq("contact_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (t) { contact = c; break; }
        }
        if (!contact) contact = exactMatches[0];
      }
      // 2) Match parcial: WhatsApp grupo (ex.: 559193910084-1603121921@g.us)
      //    ou variações com/sem DDI/9. Usa os últimos 8 dígitos do número.
      if (!contact) {
        // Extrai os últimos 8 dígitos do telefone do Typebot (ex.: 93910084 de 5591993910084)
        const tail = phoneRaw.slice(-8);
        if (tail.length === 8) {
          // Busca contatos cujo phone (após remover não-dígitos) contenha esses 8 dígitos
          // Como contatos do WhatsApp podem estar como "559193910084-1603121921@g.us",
          // precisamos comparar APENAS a parte numérica antes de qualquer "-" ou "@".
          const { data: allContacts } = await supabase
            .from("contacts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(2000);
          const partialMatches = (allContacts ?? []).filter((c: any) => {
            const raw = String(c.phone ?? "");
            // Pega só o "número" antes de '-' ou '@' (ex.: "559193910084")
            const numericPart = raw.split(/[-@]/)[0].replace(/\D/g, "");
            if (!numericPart) return false;
            // Casa pelos últimos 8 dígitos OU se uma das variantes baterem
            if (numericPart.endsWith(tail)) return true;
            return variants.includes(numericPart);
          });
          if (partialMatches && partialMatches.length > 0) {
            // Prioriza contato que JÁ tem ticket aberto/em andamento
            for (const c of partialMatches) {
              const { data: t } = await supabase
                .from("tickets")
                .select("id")
                .eq("contact_id", c.id)
                .in("status", ["open", "in_progress"])
                .limit(1)
                .maybeSingle();
              if (t) { contact = c; break; }
            }
            if (!contact) contact = partialMatches[0];
          }
        }
      }
      if (!contact) {
        const { data: created } = await supabase
          .from("contacts")
          .upsert(
            { phone: phoneRaw, name: nameInput ? String(nameInput) : null },
            { onConflict: "phone" }
          )
          .select()
          .single();
        contact = created;
      }
      if (contact) {
        contactId = contact.id;
        // Para NPS, aceitamos qualquer ticket recente (inclusive resolved/closed).
        // Para os demais eventos, priorizamos open/in_progress.
        const statusesToMatch = event === "nps"
          ? ["open", "in_progress", "resolved", "closed"]
          : ["open", "in_progress"];
        const { data: existing } = await supabase
          .from("tickets")
          .select("*")
          .eq("contact_id", contact.id)
          .in("status", statusesToMatch)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        ticket = existing;

        // Para NPS sem ticket existente, cria um ticket "fechado" para registrar a avaliação
        if (!ticket && event === "nps") {
          const { data: newTicket } = await supabase
            .from("tickets")
            .insert({
              contact_id: contact.id,
              subject: "Avaliação NPS",
              description: "Ticket criado automaticamente para registrar avaliação NPS.",
              source: "typebot",
              status: "closed",
              priority: "low",
            })
            .select()
            .single();
          ticket = newTicket;
        }

        if (!ticket && event === "flow_started") {
          const { data: newTicket } = await supabase
            .from("tickets")
            .insert({
              contact_id: contact.id,
              subject: stepInput
                ? `Fluxo: ${String(stepInput).slice(0, 100)}`
                : "Atendimento via Typebot",
              description: messageInput ? String(messageInput) : "Fluxo iniciado pelo cliente",
              source: "typebot",
              sector: sectorInput ? String(sectorInput).slice(0, 80) : null,
              status: "open",
              priority: "medium",
            })
            .select()
            .single();
          ticket = newTicket;
        }
      }
    }
  }

  if (!ticket) {
    return json(
      { error: "Ticket não encontrado. Envie ticket_id, phone ou use event=flow_started." },
      404,
    );
  }

  // 2) Trata cada tipo de evento
  if (event === "nps") {
    const score = Number(scoreInput);
    if (!score || score < 1 || score > 5) {
      return json({ error: "score deve ser número entre 1 e 5" }, 400);
    }
    await supabase
      .from("tickets")
      .update({
        nps_score: score,
        nps_comment: commentInput ? String(commentInput).slice(0, 500) : null,
        nps_submitted_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    await supabase.from("messages").insert({
      ticket_id: ticket.id,
      contact_id: contactId,
      direction: "inbound",
      content: `⭐ NPS: ${score}/5${commentInput ? `\n"${String(commentInput)}"` : ""}`,
      message_type: "text",
      sender_label: "nps",
    });

    return json({ ok: true, ticket_id: ticket.id, nps: score });
  }

  // Eventos de fluxo (started/step/ended/bot_message/user_message)
  let label: string;
  let direction: "inbound" | "outbound" = "inbound";
  let content: string;

  switch (event) {
    case "flow_started": {
      label = "system";
      direction = "inbound";
      const ident: string[] = [];
      if (nameInput) ident.push(String(nameInput));
      if (sectorInput) ident.push(String(sectorInput));
      content =
        `▶ Fluxo iniciado${stepInput ? ` — ${stepInput}` : ""}` +
        (ident.length ? `\nCliente: ${ident.join(" • ")}` : "") +
        (messageInput ? `\n${messageInput}` : "");
      break;
    }
    case "flow_ended": {
      label = "system";
      direction = "inbound";
      content =
        `■ Fluxo encerrado${stepInput ? ` — ${stepInput}` : ""}` +
        (messageInput ? `\n${messageInput}` : "");
      break;
    }
    case "flow_step": {
      label = "bot";
      direction = "outbound";
      const parts: string[] = [];
      if (stepInput) parts.push(`[${stepInput}]`);
      if (questionInput) parts.push(String(questionInput));
      if (answerInput) parts.push(`↳ Resposta: ${answerInput}`);
      if (messageInput && !questionInput && !answerInput) parts.push(String(messageInput));
      content = parts.join("\n") || "Etapa do fluxo";
      // resposta do usuário em uma etapa registramos como inbound separado
      if (answerInput) {
        await supabase.from("messages").insert({
          ticket_id: ticket.id,
          contact_id: contactId,
          direction: "outbound",
          content: questionInput
            ? `[${stepInput ?? "Etapa"}] ${questionInput}`
            : `[${stepInput ?? "Etapa"}]`,
          message_type: "text",
          sender_label: "bot",
        });
        await supabase.from("messages").insert({
          ticket_id: ticket.id,
          contact_id: contactId,
          direction: "inbound",
          content: String(answerInput),
          message_type: "text",
          sender_label: "user",
        });
        return json({ ok: true, ticket_id: ticket.id });
      }
      break;
    }
    case "bot_message": {
      label = "bot";
      direction = "outbound";
      content = String(messageInput ?? "Mensagem do bot");
      break;
    }
    case "user_message": {
      label = "user";
      direction = "inbound";
      content = String(messageInput ?? answerInput ?? "");
      break;
    }
    default:
      return json({ error: `Evento desconhecido: ${event}` }, 400);
  }

  await supabase.from("messages").insert({
    ticket_id: ticket.id,
    contact_id: contactId,
    direction,
    content,
    message_type: "text",
    sender_label: label,
  });

  return json({ ok: true, ticket_id: ticket.id, event });
}

/**
 * Gera variações de um telefone BR para tentar casar com o que está salvo.
 * Aceita entradas como "+55 (91) 99391-0084", "91993910084", "993910084".
 */
function buildPhoneVariants(input: string): string[] {
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return [];
  const set = new Set<string>([digits]);

  // Remove DDI 55 se presente
  let local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  set.add(local);

  // Se tem DDD + 9 dígitos (celular com 9), tenta também sem o "9" extra
  if (local.length === 11) {
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    if (rest.startsWith("9")) {
      set.add(ddd + rest.slice(1)); // sem 9
    }
  }
  // Se tem DDD + 8 dígitos, tenta com o "9" adicionado
  if (local.length === 10) {
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    set.add(ddd + "9" + rest);
  }

  // Adiciona versões com DDI 55 para todas as variações locais
  const all = new Set<string>(set);
  for (const v of set) {
    if (!v.startsWith("55")) all.add("55" + v);
  }
  return Array.from(all);
}