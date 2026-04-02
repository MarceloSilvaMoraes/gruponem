import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TicketWithContact } from "@/hooks/useTickets";

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

interface TicketCardProps {
  ticket: TicketWithContact;
  onClick: () => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4"
      style={{
        borderLeftColor: `hsl(var(--ticket-${ticket.status.replace("_", "_")}))`,
      }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" style={{ fontFamily: "var(--font-display)" }}>
              {ticket.subject || "Sem assunto"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {ticket.ai_summary || "Sem resumo"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full status-${ticket.status}`}>
              {statusLabels[ticket.status]}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full priority-${ticket.priority}`}>
              {priorityLabels[ticket.priority]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {ticket.contacts?.name || ticket.contacts?.phone || "Desconhecido"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(ticket.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </span>
          {ticket.category && (
            <Badge variant="secondary" className="text-[10px] h-4">
              {ticket.category}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
