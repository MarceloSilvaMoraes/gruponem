import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, User, MapPin, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type Booking = {
  id: string;
  requester_name: string;
  requester_phone: string;
  start_time: string;
  end_time: string;
  description: string;
  status: string;
  environment: {
    name: string;
  };
};

export default function Agenda() {
  const [search, setSearch] = useState("");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings-from-tickets"],
    queryFn: async () => {
      // Buscamos chamados da categoria 'booking' ou que comecem com [AGENDA]
      const { data, error } = await (supabase as any)
        .from("tickets")
        .select(`
          id,
          subject,
          category,
          created_at,
          status,
          contact:contacts(name, phone)
        `)
        .or("category.eq.booking,subject.ilike.[AGENDA]%")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map((t: any) => ({
        id: t.id,
        requester_name: t.contact?.name || "Desconhecido",
        requester_phone: t.contact?.phone || "",
        // Tentamos extrair informações do título: "[AGENDA] Sala 01 - 14:00"
        environment_name: t.subject.replace("[AGENDA]", "").split("-")[0].trim(),
        start_time: t.created_at, 
        end_time: t.created_at,
        description: t.subject,
        status: t.status === "closed" ? "confirmed" : "pending"
      }));
    },
  });

  const filteredBookings = bookings?.filter(b => 
    b.requester_name.toLowerCase().includes(search.toLowerCase()) ||
    b.environment_name.toLowerCase().includes(search.toLowerCase()) ||
    b.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Agenda de Ambientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe as reservas de salas e auditórios feitas pelo WhatsApp
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar reserva..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-center py-10 text-muted-foreground">Carregando agenda...</p>
        ) : filteredBookings?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum agendamento encontrado
            </CardContent>
          </Card>
        ) : (
          filteredBookings?.map((booking) => (
            <Card key={booking.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="bg-primary/5 p-4 flex flex-col items-center justify-center min-w-[120px] border-r">
                    <span className="text-2xl font-bold text-primary">
                      {format(new Date(booking.start_time), "dd")}
                    </span>
                    <span className="text-xs uppercase font-medium text-primary/70">
                      {format(new Date(booking.start_time), "MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="p-4 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg leading-tight">
                          {booking.description || "Sem descrição"}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{booking.environment_name || "Ambiente removido"}</span>
                        </div>
                      </div>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                        {booking.status === "confirmed" ? "Confirmado" : "Pendente"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(booking.start_time), "HH:mm")} - {format(new Date(booking.end_time), "HH:mm")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{booking.requester_name}</span>
                        <span className="text-xs text-muted-foreground">({booking.requester_phone})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
