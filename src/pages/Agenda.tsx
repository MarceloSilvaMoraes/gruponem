import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, User, MapPin, Search, Monitor, ArrowLeft } from "lucide-react";
import { format, parse, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Agenda() {
  const [search, setSearch] = useState("");
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: bookings, isLoading, error: queryError } = useQuery({
    queryKey: ["bookings-combined"],
    refetchInterval: 60000,
    queryFn: async () => {
      try {
        const now = new Date();
        const results: any[] = [];

        // 1. Buscar da nova tabela 'bookings' (se existir)
        const { data: newBookings, error: bErr } = await (supabase as any)
          .from("bookings")
          .select(`*, environment:environments(name)`)
          .order("start_time", { ascending: true });

        if (!bErr && newBookings) {
          newBookings.forEach((b: any) => {
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            results.push({
              id: b.id,
              requester_name: b.requester_name,
              requester_phone: b.requester_phone,
              environment_name: b.environment?.name || "Ambiente removido",
              start_time: b.start_time,
              display_time: `${format(start, "HH:mm")} às ${format(end, "HH:mm")}`,
              description: b.description,
              status: b.status,
              is_past: now > end,
              is_ongoing: now >= start && now <= end,
              source: "bookings"
            });
          });
        }

        // 2. Buscar dos tickets antigos (Retrocompatibilidade)
        const { data: tickets, error: tErr } = await (supabase as any)
          .from("tickets")
          .select(`id, subject, category, created_at, status, contact:contacts(name, phone)`)
          .or("category.eq.booking,subject.ilike.[AGENDA]%")
          .order("created_at", { ascending: false });

        if (!tErr && tickets) {
          tickets.forEach((t: any) => {
            let displayDate = new Date(t.created_at);
            let displayTime = "Horário não inf.";
            const dateMatch = t.subject.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              try {
                const currentYear = new Date().getFullYear();
                displayDate = parse(`${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${currentYear}`, "dd/MM/yyyy", new Date());
              } catch (e) {}
            }

            const timeRangeMatch = t.subject.match(/(\d{1,2}[:h]\d{2}|\d{1,2}h)\s*(?:as|às|-|to)\s*(\d{1,2}[:h]\d{2}|\d{1,2}h)/i);
            const singleTimeMatch = t.subject.match(/(\d{1,2}[:h]\d{2})|(\d{1,2}h)/i);
            let startTimeStr = "";
            let endTimeStr = "";
            if (timeRangeMatch) {
              startTimeStr = timeRangeMatch[1].toLowerCase().replace("h", ":00");
              endTimeStr = timeRangeMatch[2].toLowerCase().replace("h", ":00");
              displayTime = `${timeRangeMatch[1]} às ${timeRangeMatch[2]}`;
            } else if (singleTimeMatch) {
              startTimeStr = singleTimeMatch[0].toLowerCase().replace("h", ":00");
              displayTime = singleTimeMatch[0];
            }

            let isPast = false;
            let isOngoing = false;
            if (isToday(displayDate) && startTimeStr) {
              const [sH, sM] = startTimeStr.split(":").map(Number);
              const start = new Date(); start.setHours(sH, sM, 0, 0);
              let end = new Date(start.getTime() + 60 * 60 * 1000);
              if (endTimeStr) {
                const [eH, eM] = endTimeStr.split(":").map(Number);
                end = new Date(); end.setHours(eH, eM, 0, 0);
              }
              isOngoing = now >= start && now <= end;
              isPast = now > end;
            } else if (!isToday(displayDate) && now > displayDate) {
              isPast = true;
            }

            results.push({
              id: t.id,
              requester_name: t.contact?.name || "Desconhecido",
              requester_phone: t.contact?.phone || "",
              environment_name: t.subject.replace("[AGENDA]", "").split("-")[0].trim(),
              start_time: displayDate.toISOString(),
              display_time: displayTime,
              description: t.subject,
              status: t.status === "closed" ? "confirmed" : "pending",
              is_past: isPast,
              is_ongoing: isOngoing,
              source: "tickets"
            });
          });
        }

        return results;
      } catch (err) {
        console.error("Erro na Agenda:", err);
        throw err;
      }
    },
  });

  const confirmBooking = async (booking: any) => {
    const table = booking.source === "tickets" ? "tickets" : "bookings";
    const status = booking.source === "tickets" ? "closed" : "confirmed";
    
    const { error } = await (supabase as any)
      .from(table)
      .update({ status })
      .eq("id", booking.id);
    
    if (error) toast.error("Erro ao confirmar");
    else {
      toast.success("Reserva confirmada");
      queryClient.invalidateQueries({ queryKey: ["bookings-combined"] });
    }
  };

  const cancelBooking = async (booking: any) => {
    if (!confirm("Deseja realmente excluir esta reserva?")) return;
    const table = booking.source === "tickets" ? "tickets" : "bookings";
    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .eq("id", booking.id);
    
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Reserva excluída");
      queryClient.invalidateQueries({ queryKey: ["bookings-combined"] });
    }
  };

  const filteredBookings = bookings?.filter(b => {
    const eventDate = startOfDay(new Date(b.start_time));
    const today = startOfDay(new Date());
    
    // Limpeza automática: Não mostrar dias que já passaram
    if (isBefore(eventDate, today)) return false;
    
    return (
      b.requester_name.toLowerCase().includes(search.toLowerCase()) ||
      b.environment_name.toLowerCase().includes(search.toLowerCase()) ||
      b.description?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (tvMode) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white z-[100] p-8 overflow-hidden flex flex-col gap-8">
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3 rounded-xl">
              <CalendarIcon className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">AGENDA DE EVENTOS</h1>
              <p className="text-slate-400 font-medium text-xl">Monitoramento em Tempo Real</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-6xl font-mono font-bold text-primary">
              {format(currentTime, "HH:mm:ss")}
            </p>
            <p className="text-xl text-slate-400 capitalize">
              {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <Button 
            variant="ghost" 
            className="absolute top-4 right-4 text-slate-500 hover:text-white"
            onClick={() => setTvMode(false)}
          >
            <ArrowLeft className="mr-2" /> Sair do Modo TV
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {filteredBookings?.map((booking) => {
            const isTodayEvent = isToday(new Date(booking.start_time));
            return (
              <div 
                key={booking.id} 
                className={`flex items-stretch rounded-2xl overflow-hidden border-2 transition-all ${
                  booking.is_past ? "opacity-40 grayscale-[0.5] border-slate-900" : 
                  booking.is_ongoing ? "border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-pulse" :
                  isTodayEvent ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.2)]" : 
                  "border-slate-800 bg-slate-900/50"
                }`}
              >
                <div className={`flex flex-col items-center justify-center min-w-[180px] p-6 ${
                  booking.is_past ? "bg-slate-900 text-slate-500" :
                  booking.is_ongoing ? "bg-green-500 text-white" :
                  isTodayEvent ? "bg-primary text-white" : "bg-slate-800 text-slate-300"
                }`}>
                  <span className="text-5xl font-black">{format(new Date(booking.start_time), "dd")}</span>
                  <span className="text-xl uppercase font-bold">{format(new Date(booking.start_time), "MMM", { locale: ptBR })}</span>
                </div>
                <div className="p-8 flex-1 flex justify-between items-center">
                  <div className="space-y-4">
                    <h2 className="text-4xl font-bold capitalize">{booking.environment_name}</h2>
                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-3 text-2xl text-slate-300">
                        <Clock className={`h-8 w-8 ${booking.is_ongoing ? "text-white" : "text-primary"}`} />
                        <span className="font-bold">{booking.display_time}</span>
                      </div>
                      <div className="flex items-center gap-3 text-2xl text-slate-300">
                        <User className={`h-8 w-8 ${booking.is_ongoing ? "text-white" : "text-primary"}`} />
                        <span>{booking.requester_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-4">
                    <Badge className={`text-2xl px-6 py-2 rounded-full ${
                      booking.is_past ? "bg-slate-700" :
                      booking.is_ongoing ? "bg-green-600 animate-bounce" :
                      booking.status === "confirmed" ? "bg-green-500" : "bg-orange-500"
                    }`}>
                      {booking.is_past ? "ENCERRADO" : 
                       booking.is_ongoing ? "ACONTECENDO AGORA" :
                       booking.status === "confirmed" ? "CONFIRMADO" : "AGUARDANDO"}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => setTvMode(true)} className="gap-2">
            <Monitor className="h-4 w-4" /> Modo TV
          </Button>
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
      </div>

      <div className="grid gap-4">
        {queryError ? (
          <div className="text-center py-10 text-destructive">
            <p className="font-bold">Erro ao carregar agenda</p>
            <p className="text-sm">{(queryError as any).message}</p>
          </div>
        ) : isLoading ? (
          <p className="text-center py-10 text-muted-foreground">Carregando agenda...</p>
        ) : filteredBookings?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum agendamento ativo ou futuro encontrado
            </CardContent>
          </Card>
        ) : (
          filteredBookings?.map((booking) => (
            <Card key={booking.id} className={`overflow-hidden hover:shadow-md transition-all ${
              booking.is_past ? "opacity-50 grayscale-[0.3]" : 
              booking.is_ongoing ? "border-green-500 bg-green-50/50 ring-1 ring-green-200" : ""
            }`}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className={`p-4 flex flex-col items-center justify-center min-w-[120px] border-r ${
                    booking.is_past ? "bg-slate-100" : 
                    booking.is_ongoing ? "bg-green-500 text-white" : "bg-primary/5"
                  }`}>
                    <span className={`text-2xl font-bold ${booking.is_past ? "text-slate-400" : booking.is_ongoing ? "text-white" : "text-primary"}`}>
                      {format(new Date(booking.start_time), "dd")}
                    </span>
                    <span className={`text-xs uppercase font-medium ${booking.is_past ? "text-slate-400" : booking.is_ongoing ? "text-white/80" : "text-primary/70"}`}>
                      {format(new Date(booking.start_time), "MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="p-4 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg leading-tight capitalize">
                          {booking.description.replace("[AGENDA]", "").split("-")[0].trim() || "Sem descrição"}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{booking.environment_name || "Ambiente removido"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={
                          booking.is_past ? "secondary" : 
                          booking.is_ongoing ? "default" :
                          booking.status === "confirmed" ? "default" : "secondary"
                        } className={booking.is_ongoing ? "bg-green-600 hover:bg-green-700" : ""}>
                          {booking.is_past ? "Encerrado" : 
                           booking.is_ongoing ? "Acontecendo agora" :
                           booking.status === "confirmed" ? "Confirmado" : "Pendente"}
                        </Badge>
                        {!booking.is_past && (
                          <div className="flex gap-1">
                            {booking.status === "pending" && !booking.is_ongoing && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                onClick={() => confirmBooking(booking)}
                              >
                                Confirmar
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs text-destructive hover:bg-destructive/5"
                              onClick={() => cancelBooking(booking)}
                            >
                              Excluir
                            </Button>
                          </div>
                        )}
                        {booking.is_past && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-xs text-destructive opacity-50 hover:opacity-100"
                            onClick={() => cancelBooking(booking)}
                          >
                            Limpar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold">
                          {booking.display_time}
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
