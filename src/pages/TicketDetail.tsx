import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Phone,
  Bot,
  Send,
  StickyNote,
  History,
  UserPlus,
  CheckCircle2,
  Trash2,
  Sparkles,
  Star,
  PlayCircle,
  StopCircle,
  User,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useTicket, useTicketMessages } from "@/hooks/useTickets";
import { useTeam, useTicketActivity, useTicketNotes } from "@/hooks/useTeam";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AssigneesPicker } from "@/components/AssigneesPicker";

const statusOptions = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: ticket, refetch: refetchTicket } = useTicket(id!);
  const { data: messages, refetch: refetchMessages } = useTicketMessages(id!);
  const { data: notes, refetch: refetchNotes } = useTicketNotes(id!);
  const { data: activity } = useTicketActivity(id!);
  const { data: team } = useTeam();
  const queryClient = useQueryClient();

  const { data: coAssignees, refetch: refetchCoAssignees } = useQuery({
    queryKey: ["ticket-assignees", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_assignees")
        .select("user_id, added_by, created_at")
        .eq("ticket_id", id!);
      if (error) throw error;
      return data as { user_id: string; added_by: string | null; created_at: string }[];
    },
    enabled: !!id,
  });

  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [internalOnly, setInternalOnly] = useState(false);

  const updateField = async (field: "status" | "priority" | "assigned_to", value: any) => {
    const { error } = await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", id!);
    if (error) toast.error("Erro ao atualizar", { description: error.message });
    else {
      toast.success("Atualizado");
      refetchTicket();
    }
  };

  const claim = () => updateField("assigned_to", user!.id);

  const setCoAssignees = async (next: string[]) => {
    const current = new Set((coAssignees ?? []).map((c) => c.user_id));
    const target = new Set(next);
    const toAdd = next.filter((uid) => !current.has(uid));
    const toRemove = (coAssignees ?? [])
      .map((c) => c.user_id)
      .filter((uid) => !target.has(uid));

    if (toAdd.length > 0) {
      const { error } = await supabase.from("ticket_assignees").insert(
        toAdd.map((uid) => ({
          ticket_id: id!,
          user_id: uid,
          added_by: user?.id ?? null,
        })),
      );
      if (error) {
        toast.error("Erro ao adicionar co-atendente", { description: error.message });
        return;
      }
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("ticket_assignees")
        .delete()
        .eq("ticket_id", id!)
        .in("user_id", toRemove);
      if (error) {
        toast.error("Erro ao remover co-atendente", { description: error.message });
        return;
      }
    }
    refetchCoAssignees();
    queryClient.invalidateQueries({ queryKey: ["ticket-assignees", id] });
    toast.success("Co-atendentes atualizados");
  };

  const sendReply = async () => {
    if (!reply.trim() || !id) return;
    setSending(true);

    try {
      if (internalOnly) {
        // Just save to DB
        const { error: msgErr } = await supabase.from("messages").insert({
          ticket_id: id,
          contact_id: ticket.contact_id,
          direction: "outbound",
          content: reply.trim(),
          message_type: "text",
          sender_label: "internal",
        });
        if (msgErr) throw msgErr;
        
        toast.success("Resposta interna salva");
      } else {
        // TYPEBOT CHAT API BYPASS: Use the chat start API to trigger the flow without 401 errors
        const phoneRaw = ticket.contacts?.phone;
        let numericPart = String(phoneRaw ?? "").split(/[-@]/)[0].replace(/\D/g, "");
        
        // Ensure Brazil DDI (55) if it looks like a local number (10 or 11 digits)
        if (numericPart.length >= 10 && numericPart.length <= 11 && !numericPart.startsWith("55")) {
          numericPart = "55" + numericPart;
        }
        
        if (!numericPart) {
          throw new Error("Este contato não possui um número de telefone válido.");
        }

        const typebotId = "meu-typebot-z8nm4zk";
        const typebotUrl = `https://typebot.io/api/v1/typebots/${typebotId}/startChat`;
        
        console.log(`Sending message via Typebot Chat API: ${typebotUrl}`);

        const payload = { 
          prefilledVariables: {
            number: numericPart,
            text: reply.trim()
          }
        };
        
        console.log("Typebot Payload:", JSON.stringify(payload, null, 2));

        const typebotRes = await fetch(typebotUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });

        if (!typebotRes.ok) {
          const errText = await typebotRes.text();
          console.error("Typebot Error Response:", errText);
          throw new Error(`Erro no Typebot: ${typebotRes.status} - ${errText}`);
        }

        // Save to DB as outbound message
        const { error: msgErr } = await supabase.from("messages").insert({
          ticket_id: id,
          contact_id: ticket.contact_id,
          direction: "outbound",
          content: reply.trim(),
          message_type: "text",
          sender_label: "agent",
        });
        if (msgErr) throw msgErr;

        // Log activity
        await supabase.from("ticket_activity").insert({
          ticket_id: id,
          actor_id: user?.id,
          action: "message_sent",
          to_value: reply.trim().substring(0, 200),
        });

        toast.success("Mensagem enviada pelo WhatsApp");
      }

      setReply("");
      refetchMessages();
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error("Falha ao enviar", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const { error } = await supabase
      .from("ticket_notes")
      .insert({ ticket_id: id!, author_id: user!.id, content: note.trim() });
    if (error) toast.error("Erro", { description: error.message });
    else {
      setNote("");
      refetchNotes();
    }
  };

  const deleteTicket = async () => {
    // remove dependentes manualmente (não há FK cascade)
    await supabase.from("messages").delete().eq("ticket_id", id!);
    await supabase.from("ticket_notes").delete().eq("ticket_id", id!);
    await supabase.from("ticket_activity").delete().eq("ticket_id", id!);
    const { error } = await supabase.from("tickets").delete().eq("id", id!);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
    } else {
      toast.success("Chamado excluído");
      navigate("/");
    }
  };

  if (!ticket) {
    return (
      <p className="text-center text-muted-foreground py-16">Carregando...</p>
    );
  }

  const assignee = team?.find((m) => m.user_id === ticket.assigned_to);
  const isMine = ticket.assigned_to === user?.id;
  const isUnassigned = !ticket.assigned_to;
  const coAssigneeIds = (coAssignees ?? []).map((c) => c.user_id);
  const isCoAssignee = !!user?.id && coAssigneeIds.includes(user.id);
  const canManage = role === "admin" || isMine || isCoAssignee;
  const canEditCoAssignees = role === "admin" || isMine;
  const memberName = (uid?: string | null) =>
    team?.find((m) => m.user_id === uid)?.display_name ?? "—";

  const npsScore: number | null = (ticket as any).nps_score ?? null;
  const npsComment: string | null = (ticket as any).nps_comment ?? null;
  const npsAt: string | null = (ticket as any).nps_submitted_at ?? null;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">
              {ticket.subject || "Sem assunto"}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {ticket.contacts?.name && (
                <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-md border border-muted-foreground/10">
                  <User className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-medium text-foreground">{ticket.contacts.name}</span>
                </div>
              )}
              
              {ticket.contacts?.phone && (
                <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-md border border-muted-foreground/10">
                  <Phone className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-medium text-foreground">{ticket.contacts.phone}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span>•</span>
                <span>{format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </div>
              
              {(ticket as any).sector && (
                <>
                  <span>•</span>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-none">
                    Setor: {(ticket as any).sector}
                  </Badge>
                </>
              )}
            </div>
          </div>
          {role === "admin" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir chamado?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todas as mensagens, notas e
                    histórico associados também serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTicket}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Control bar */}
        <div className="bg-card rounded-xl border p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={ticket.status}
              onValueChange={(v) => updateField("status", v)}
              disabled={!canManage}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prioridade</label>
            <Select
              value={ticket.priority}
              onValueChange={(v) => updateField("priority", v)}
              disabled={!canManage}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Responsável</label>
            {role === "admin" ? (
              <Select
                value={ticket.assigned_to ?? "__none__"}
                onValueChange={(v) =>
                  updateField("assigned_to", v === "__none__" ? null : v)
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não atribuído</SelectItem>
                  {team?.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 px-3 flex items-center text-sm border rounded-md bg-muted/30">
                {assignee?.display_name ?? "Não atribuído"}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ação rápida</label>
            {isUnassigned ? (
              <Button onClick={claim} className="w-full">
                <UserPlus className="h-4 w-4" /> Pegar chamado
              </Button>
            ) : isMine && ticket.status !== "resolved" ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => updateField("status", "resolved")}
              >
                <CheckCircle2 className="h-4 w-4" /> Marcar resolvido
              </Button>
            ) : (
              <div className="h-10 px-3 flex items-center text-xs text-muted-foreground border rounded-md">
                Atribuído a {assignee?.display_name ?? "—"}
              </div>
            )}
          </div>
        </div>

        {/* Co-atendentes */}
        <div className="bg-card rounded-xl border p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground">
              Co-atendentes ({coAssigneeIds.length})
            </label>
            {!canEditCoAssignees && coAssigneeIds.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhum</span>
            )}
          </div>
          {canEditCoAssignees ? (
            <AssigneesPicker
              value={coAssigneeIds}
              onChange={setCoAssignees}
              excludeUserId={ticket.assigned_to}
              placeholder="Adicionar pessoas do time para atender junto..."
            />
          ) : coAssigneeIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {coAssigneeIds.map((uid) => (
                <Badge key={uid} variant="secondary">
                  {memberName(uid)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* AI summary */}
        {ticket.ai_summary && (
          <div className="bg-accent/40 rounded-xl border p-3 mb-4 flex gap-2 text-sm">
            <Bot className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div>
              <span className="font-medium">Resumo IA:</span>{" "}
              <span className="text-muted-foreground">{ticket.ai_summary}</span>
              {ticket.category && (
                <Badge variant="secondary" className="ml-2">{ticket.category}</Badge>
              )}
            </div>
          </div>
        )}

        {/* NPS card */}
        <NpsCard score={npsScore} comment={npsComment} submittedAt={npsAt} />

        {/* Tabs */}
        <Tabs defaultValue="conversation">
          <TabsList>
            <TabsTrigger value="conversation">Conversa</TabsTrigger>
            <TabsTrigger value="notes">
              <StickyNote className="h-3 w-3 mr-1" /> Notas internas
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History className="h-3 w-3 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Conversation */}
          <TabsContent value="conversation" className="bg-card rounded-xl border p-4 mt-3">
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {messages?.map((msg: any) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {(!messages || messages.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Nenhuma mensagem ainda
                </p>
              )}
            </div>

            {canManage ? (
              <div className="mt-4 border-t pt-4 space-y-2">
                <div className="flex gap-2">
                  <Textarea
                    placeholder={internalOnly
                      ? "Resposta interna (não vai para o WhatsApp)..."
                      : "Responder ao cliente via WhatsApp..."}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                    <Send className="h-4 w-4" />
                    {sending ? "Enviando..." : internalOnly ? "Salvar" : "Enviar"}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={internalOnly}
                    onChange={(e) => setInternalOnly(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  Apenas no chamado (não enviar pelo WhatsApp)
                </label>
              </div>
            ) : (
              <p className="mt-4 border-t pt-4 text-xs text-muted-foreground text-center">
                Pegue o chamado para poder responder.
              </p>
            )}
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes" className="bg-card rounded-xl border p-4 mt-3">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {notes?.map((n: any) => (
                <div key={n.id} className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/20">
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {memberName(n.author_id)} • {format(new Date(n.created_at), "dd/MM HH:mm")}
                  </p>
                </div>
              ))}
              {(!notes || notes.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-6">
                  Nenhuma nota interna
                </p>
              )}
            </div>
            <div className="mt-4 border-t pt-4 flex gap-2">
              <Textarea
                placeholder="Adicionar nota interna (visível só para a equipe)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <Button onClick={addNote} disabled={!note.trim()} variant="secondary">
                Adicionar
              </Button>
            </div>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="bg-card rounded-xl border p-4 mt-3">
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {activity?.map((a: any) => (
                <div key={a.id} className="text-sm flex items-start gap-2 py-1.5 border-b last:border-0">
                  <span className="text-xs text-muted-foreground shrink-0 w-28">
                    {format(new Date(a.created_at), "dd/MM HH:mm")}
                  </span>
                  <span className="font-medium">{memberName(a.actor_id)}</span>
                  <span className="text-muted-foreground">
                    {describeAction(a, memberName)}
                  </span>
                </div>
              ))}
              {(!activity || activity.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-6">
                  Sem registro de atividades
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
}

// ============== Componentes auxiliares ==============
function MessageBubble({ msg }: { msg: any }) {
  const label: string | null = msg.sender_label ?? null;

  // Eventos de sistema (flow_started / flow_ended) — barra centralizada
  if (label === "system") {
    const isStart = msg.content?.startsWith("▶");
    const isEnd = msg.content?.startsWith("■");
    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border text-[11px] text-muted-foreground">
          {isStart ? (
            <PlayCircle className="h-3 w-3 text-primary" />
          ) : isEnd ? (
            <StopCircle className="h-3 w-3 text-destructive" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          <span className="whitespace-pre-wrap text-center">{msg.content}</span>
          <span className="opacity-70">• {format(new Date(msg.created_at), "HH:mm")}</span>
        </div>
      </div>
    );
  }

  // Mensagem NPS — destaque
  if (label === "nps") {
    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
          <Star className="h-3.5 w-3.5 fill-current" />
          <span className="whitespace-pre-wrap font-medium">{msg.content}</span>
        </div>
      </div>
    );
  }

  const isBot = label === "bot";
  const isOutbound = msg.direction === "outbound";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} gap-2`}>
      {!isOutbound && (
        <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center">
          {isBot ? (
            <Bot className="h-3.5 w-3.5 text-primary" />
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isOutbound
            ? isBot
              ? "bg-primary/15 text-foreground border border-primary/30 rounded-br-md"
              : "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-secondary-foreground rounded-bl-md"
        }`}
      >
        {isBot && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
              IA / Bot
            </span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <p
          className={`text-[10px] mt-1 ${
            isOutbound && !isBot ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {format(new Date(msg.created_at), "HH:mm")}
        </p>
      </div>
    </div>
  );
}

function NpsCard({
  score,
  comment,
  submittedAt,
}: {
  score: number | null;
  comment: string | null;
  submittedAt: string | null;
}) {
  if (!score) {
    return (
      <div className="bg-muted/40 rounded-xl border border-dashed p-3 mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Star className="h-4 w-4" />
        Aguardando avaliação NPS do cliente (1 a 5).
      </div>
    );
  }
  const tone =
    score >= 4
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
      : score === 3
      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
      : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400";

  return (
    <div className={`rounded-xl border p-4 mb-4 ${tone}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-5 w-5 ${n <= score ? "fill-current" : "opacity-30"}`}
            />
          ))}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            Avaliação NPS: {score}/5
          </p>
          {submittedAt && (
            <p className="text-[11px] opacity-80">
              Recebida em {format(new Date(submittedAt), "dd/MM/yyyy HH:mm")}
            </p>
          )}
        </div>
      </div>
      {comment && (
        <p className="text-sm mt-2 italic opacity-90">"{comment}"</p>
      )}
    </div>
  );
}

function describeAction(a: any, memberName: (uid?: string | null) => string) {
  switch (a.action) {
    case "created":
      return `criou o chamado (${a.to_value})`;
    case "status_changed":
      return `mudou status: ${a.from_value} → ${a.to_value}`;
    case "priority_changed":
      return `mudou prioridade: ${a.from_value} → ${a.to_value}`;
    case "claimed":
      return `pegou o chamado`;
    case "unassigned":
      return `removeu a atribuição`;
    case "reassigned":
      return `reatribuiu para ${memberName(a.to_value)}`;
    case "message_sent":
      return `enviou mensagem ao cliente`;
    default:
      return a.action;
  }
}