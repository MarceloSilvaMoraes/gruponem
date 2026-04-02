import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Phone, Bot, User } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useTicket, useTicketMessages } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ticket, refetch: refetchTicket } = useTicket(id!);
  const { data: messages } = useTicketMessages(id!);

  const updateStatus = async (status: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ status: status as any })
      .eq("id", id!);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success("Status atualizado");
      refetchTicket();
    }
  };

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {ticket.subject || "Sem assunto"}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {ticket.contacts?.name || ticket.contacts?.phone}
              <span>•</span>
              {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
          <Select value={ticket.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info */}
        <div className="bg-card rounded-xl border p-4 mb-4">
          <div className="flex gap-3 flex-wrap">
            <Badge variant="secondary">{ticket.category || "geral"}</Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full priority-${ticket.priority}`}>
              {ticket.priority}
            </span>
          </div>
          {ticket.ai_summary && (
            <div className="mt-3 p-3 rounded-lg bg-accent/50 text-sm flex gap-2">
              <Bot className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <span className="font-medium text-accent-foreground">Resumo IA:</span>{" "}
                <span className="text-muted-foreground">{ticket.ai_summary}</span>
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="bg-card rounded-xl border p-4">
          <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Mensagens
          </h2>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {messages?.map((msg) => (
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
                  <p>{msg.content}</p>
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
        </div>
      </div>
    </div>
  );
}
