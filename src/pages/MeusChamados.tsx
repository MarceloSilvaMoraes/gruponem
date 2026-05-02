import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bot, LogOut, MessageCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export default function MeusChamados() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, contacts(name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold">Meus Chamados</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/auth"))}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {isLoading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}
        {!isLoading && tickets?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Você ainda não possui chamados abertos.
              <br />
              Envie uma mensagem pelo WhatsApp para iniciar.
            </CardContent>
          </Card>
        )}
        {tickets?.map((t) => (
          <Card
            key={t.id}
            className="cursor-pointer hover:shadow-md transition"
            onClick={() => navigate(`/meus-chamados/${t.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.subject || "Sem assunto"}</CardTitle>
                <Badge variant="secondary">{statusLabels[t.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p className="line-clamp-2">{t.ai_summary || t.description || "—"}</p>
              <p className="mt-2">
                Aberto em {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

export function MeuChamadoDetalhe() {
  const navigate = useNavigate();
  const id = window.location.pathname.split("/").pop();

  const { data: ticket } = useQuery({
    queryKey: ["my-ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, contacts(name, phone)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["my-ticket-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("ticket_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 8000,
  });

  if (!ticket) return <p className="text-center py-12 text-muted-foreground">Carregando...</p>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/meus-chamados")}>
            ← Voltar
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{ticket.subject || "Sem assunto"}</h1>
            <p className="text-xs text-muted-foreground">
              Status: {statusLabels[ticket.status]}
            </p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Histórico do atendimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
            {messages?.map((m: any) => {
              const label = m.sender_label;
              const isBot = label === "bot";
              const isOut = m.direction === "outbound";
              if (label === "system" || label === "nps") {
                return (
                  <div key={m.id} className="text-center text-[11px] text-muted-foreground">
                    {m.content}
                  </div>
                );
              }
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${isOut ? "justify-end" : "justify-start"}`}
                >
                  {!isOut && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {isBot ? (
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isOut
                        ? isBot
                          ? "bg-primary/15 border border-primary/30"
                          : "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    {isBot && (
                      <p className="text-[10px] font-semibold text-primary uppercase mb-1">
                        IA / Bot
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] opacity-70 mt-1">
                      {format(new Date(m.created_at), "dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
            {(!messages || messages.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhuma mensagem ainda
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}