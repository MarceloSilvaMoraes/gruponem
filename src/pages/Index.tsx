import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Trash2, X } from "lucide-react";
import { useTickets } from "@/hooks/useTickets";
import { TicketCard } from "@/components/TicketCard";
import { StatsBar } from "@/components/StatsBar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const statusTabs = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertos" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvidos" },
  { value: "closed", label: "Fechados" },
];

export default function Index() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [scope, setScope] = useState<"mine" | "unassigned" | "all">("mine");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: tickets, isLoading } = useTickets(statusFilter);
  const queryClient = useQueryClient();

  const scoped = useMemo(() => {
    if (!tickets) return [];
    if (scope === "mine") return tickets.filter((t) => t.assigned_to === user?.id);
    if (scope === "unassigned") return tickets.filter((t) => !t.assigned_to);
    return tickets;
  }, [tickets, scope, user?.id]);

  const filtered = scoped.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.contacts?.name?.toLowerCase().includes(q) ||
      t.contacts?.phone?.includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(filtered.map((t) => t.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDeleting(true);
    await supabase.from("messages").delete().in("ticket_id", ids);
    await supabase.from("ticket_notes").delete().in("ticket_id", ids);
    await supabase.from("ticket_activity").delete().in("ticket_id", ids);
    const { error } = await supabase.from("tickets").delete().in("id", ids);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
    } else {
      toast.success(`${ids.length} chamado(s) excluído(s)`);
      exitSelectMode();
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-stats"] });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Central de Chamados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {role === "admin"
              ? "Você vê todos os chamados (admin)"
              : "Você vê seus chamados e os disponíveis para pegar"}
          </p>
        </div>

        <StatsBar />

        <div className="flex flex-col gap-3">
          <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
            <TabsList>
              <TabsTrigger value="mine">Meus chamados</TabsTrigger>
              <TabsTrigger value="unassigned">Disponíveis</TabsTrigger>
              {role === "admin" && <TabsTrigger value="all">Todos</TabsTrigger>}
            </TabsList>
          </Tabs>

          {role === "admin" && (
            <div className="flex items-center gap-2 flex-wrap">
              {!selectMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectMode(true)}
                >
                  <Trash2 className="h-4 w-4" /> Selecionar para excluir
                </Button>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selected.size} selecionado(s)
                  </span>
                  <Button variant="outline" size="sm" onClick={selectAllVisible}>
                    Selecionar todos visíveis
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={selected.size === 0 || deleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir {selected.size > 0 ? `(${selected.size})` : ""}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Excluir {selected.size} chamado(s)?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Mensagens, notas e
                          histórico desses chamados também serão removidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteSelected}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </>
              )}
            </div>
          )}

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
              onClick={() =>
                selectMode
                  ? toggleSelect(ticket.id)
                  : navigate(`/ticket/${ticket.id}`)
              }
              selectable={selectMode}
              selected={selected.has(ticket.id)}
              onToggleSelect={() => toggleSelect(ticket.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
