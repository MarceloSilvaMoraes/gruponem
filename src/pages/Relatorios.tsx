import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Preset = "day" | "week" | "month" | "custom";

function getRange(preset: Preset, anchor: Date, customFrom?: Date, customTo?: Date) {
  if (preset === "day") return { from: startOfDay(anchor), to: endOfDay(anchor) };
  if (preset === "week")
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  if (preset === "month")
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return {
    from: startOfDay(customFrom ?? subDays(anchor, 7)),
    to: endOfDay(customTo ?? anchor),
  };
}

export default function Relatorios() {
  const [preset, setPreset] = useState<Preset>("day");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const range = useMemo(
    () => getRange(preset, anchor, customFrom, customTo),
    [preset, anchor, customFrom, customTo],
  );

  // Monthly calendar: count tickets per day for the month of `anchor`
  const monthRange = useMemo(
    () => ({ from: startOfMonth(anchor), to: endOfMonth(anchor) }),
    [anchor],
  );
  const { data: monthTickets } = useQuery({
    queryKey: ["calendar-month", monthRange.from.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("created_at")
        .gte("created_at", monthRange.from.toISOString())
        .lte("created_at", monthRange.to.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTickets ?? []) {
      const k = format(new Date((t as any).created_at), "yyyy-MM-dd");
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [monthTickets]);

  const { data: tickets } = useQuery({
    queryKey: ["report-tickets", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, contacts(name, phone)")
        .gte("created_at", range.from.toISOString())
        .lte("created_at", range.to.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = tickets ?? [];
    const npsValid = list.filter((t: any) => t.nps_score != null);
    const npsAvg = npsValid.length
      ? npsValid.reduce((s: number, t: any) => s + (t.nps_score || 0), 0) / npsValid.length
      : null;
    return {
      total: list.length,
      open: list.filter((t: any) => t.status === "open").length,
      in_progress: list.filter((t: any) => t.status === "in_progress").length,
      resolved: list.filter((t: any) => t.status === "resolved").length,
      closed: list.filter((t: any) => t.status === "closed").length,
      urgent: list.filter((t: any) => t.priority === "urgent").length,
      npsAvg,
      npsCount: npsValid.length,
    };
  }, [tickets]);

  const exportCSV = () => {
    const list = tickets ?? [];
    const header = [
      "criado_em",
      "assunto",
      "status",
      "prioridade",
      "categoria",
      "contato",
      "telefone",
      "nps",
    ];
    const rows = list.map((t: any) => [
      t.created_at,
      (t.subject ?? "").replace(/[\n;]/g, " "),
      t.status,
      t.priority,
      t.category ?? "",
      t.contacts?.name ?? "",
      t.contacts?.phone ?? "",
      t.nps_score ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada dos chamados por período
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <TabsList>
              <TabsTrigger value="day">Diário</TabsTrigger>
              <TabsTrigger value="week">Semanal</TabsTrigger>
              <TabsTrigger value="month">Mensal</TabsTrigger>
              <TabsTrigger value="custom">Personalizado</TabsTrigger>
            </TabsList>
          </Tabs>

          {preset !== "custom" ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[260px] justify-start">
                  <CalendarIcon className="h-4 w-4" />
                  {format(anchor, "PPP", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={anchor}
                  onSelect={(d) => d && setAnchor(d)}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start">
                    <CalendarIcon className="h-4 w-4" />
                    {customFrom ? format(customFrom, "PPP", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start">
                    <CalendarIcon className="h-4 w-4" />
                    {customTo ? format(customTo, "PPP", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Período: {format(range.from, "dd/MM/yyyy HH:mm")} → {format(range.to, "dd/MM/yyyy HH:mm")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Calendário — {format(anchor, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={anchor}
            onSelect={(d) => {
              if (!d) return;
              setAnchor(d);
              setPreset("day");
            }}
            month={anchor}
            onMonthChange={(m) => setAnchor(m)}
            locale={ptBR}
            className="p-3 pointer-events-auto"
            components={{
              DayContent: (p: any) => {
                const k = format(p.date, "yyyy-MM-dd");
                const n = countsByDay.get(k) ?? 0;
                return (
                  <div className="relative flex flex-col items-center justify-center w-full h-full">
                    <span>{p.date.getDate()}</span>
                    {n > 0 && (
                      <span className="absolute -bottom-1 text-[9px] font-bold text-primary leading-none">
                        {n}
                      </span>
                    )}
                  </div>
                );
              },
            }}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Clique em um dia para filtrar o relatório do dia.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Abertos", value: stats.open },
          { label: "Em andamento", value: stats.in_progress },
          { label: "Resolvidos", value: stats.resolved },
          { label: "Fechados", value: stats.closed },
          { label: "Urgentes", value: stats.urgent },
          {
            label: "NPS médio",
            value: stats.npsAvg != null ? stats.npsAvg.toFixed(1) : "—",
          },
          { label: "Respostas NPS", value: stats.npsCount },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chamados no período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(tickets ?? []).map((t: any) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-3 border rounded-md text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{t.subject ?? "Sem assunto"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t.contacts?.name ?? t.contacts?.phone ?? "—"} •{" "}
                  {format(new Date(t.created_at), "dd/MM HH:mm")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded bg-muted text-xs">{t.status}</span>
                <span className="px-2 py-0.5 rounded bg-muted text-xs">{t.priority}</span>
              </div>
            </div>
          ))}
          {(tickets ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum chamado no período
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}