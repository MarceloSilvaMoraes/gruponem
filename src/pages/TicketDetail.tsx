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

  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

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

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke("send-whatsapp-message", {
      body: { ticket_id: id, content: reply.trim() },
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao enviar", { description: error.message });
    } else {
      toast.success("Mensagem enviada");
      setReply("");
      refetchMessages();
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
  const canManage = role === "admin" || isMine;
  const memberName = (uid?: string | null) =>
    team?.find((m) => m.user_id === uid)?.display_name ?? "—";

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
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <Phone className="h-3 w-3" />
              {ticket.contacts?.name || ticket.contacts?.phone}
              <span>•</span>
              {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {(ticket as any).sector && (
                <>
                  <span>•</span>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    Setor: {(ticket as any).sector}
                  </Badge>
                </>
              )}
            </p>
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
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-secondary-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(msg.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
              {(!messages || messages.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Nenhuma mensagem ainda
                </p>
              )}
            </div>

            {canManage ? (
              <div className="mt-4 border-t pt-4 flex gap-2">
                <Textarea
                  placeholder="Responder ao cliente via WhatsApp..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                  <Send className="h-4 w-4" />
                  {sending ? "Enviando..." : "Enviar"}
                </Button>
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