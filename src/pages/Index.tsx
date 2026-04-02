import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { useTickets } from "@/hooks/useTickets";
import { TicketCard } from "@/components/TicketCard";
import { StatsBar } from "@/components/StatsBar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusTabs = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertos" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvidos" },
  { value: "closed", label: "Fechados" },
];

export default function Index() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data: tickets, isLoading } = useTickets(statusFilter);

  const filtered = tickets?.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.contacts?.name?.toLowerCase().includes(q) ||
      t.contacts?.phone?.includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            🎫 Central de Tickets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie atendimentos do WhatsApp com IA
          </p>
        </div>

        <StatsBar />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              {statusTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Ticket List */}
        <div className="space-y-3">
          {isLoading && (
            <p className="text-center text-muted-foreground py-12">Carregando...</p>
          )}
          {!isLoading && filtered?.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Nenhum ticket encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Os tickets serão criados automaticamente quando mensagens chegarem pelo WhatsApp
              </p>
            </div>
          )}
          {filtered?.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
