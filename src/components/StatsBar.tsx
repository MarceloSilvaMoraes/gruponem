import { Ticket, MessageSquare, BarChart3, Inbox } from "lucide-react";
import { useTicketStats } from "@/hooks/useTickets";

const statConfig = [
  { key: "total", label: "Total", icon: Ticket, color: "var(--foreground)" },
  { key: "open", label: "Abertos", icon: Inbox, color: "hsl(var(--ticket-open))" },
  { key: "in_progress", label: "Em andamento", icon: MessageSquare, color: "hsl(var(--ticket-in-progress))" },
  { key: "resolved", label: "Resolvidos", icon: BarChart3, color: "hsl(var(--ticket-resolved))" },
] as const;

export function StatsBar() {
  const { data: stats } = useTicketStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statConfig.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="bg-card rounded-xl p-4 border flex items-center gap-3"
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {stats?.[key] ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
