import { useNavigate } from "react-router-dom";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Inbox,
  CheckCircle2,
  Clock,
  Users,
  AlertTriangle,
  Headphones,
  ArrowUpRight,
  Activity,
  Star,
} from "lucide-react";
import { useTickets, useTicketStats } from "@/hooks/useTickets";
import { useMetricsByMember, useTeam } from "@/hooks/useTeam";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

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

function shortId(id: string) {
  return "TK-" + id.slice(0, 4).toUpperCase();
}

function relativeTime(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.floor(diff)} min`;
  const h = diff / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Index() {
  const navigate = useNavigate();
  const { data: stats } = useTicketStats();
  const { data: tickets } = useTickets("all");
  const { data: team } = useTeam();
  const { data: metrics } = useMetricsByMember();

  const recent = (tickets ?? []).slice(0, 5);
  const urgentes = (tickets ?? []).filter(
    (t) => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved",
  ).length;

  const resolvedToday = (tickets ?? []).filter(
    (t) => (t.status === "resolved" || t.status === "closed") && isToday(new Date(t.updated_at)),
  ).length;

  const allAvg =
    (metrics ?? [])
      .filter((m) => m.avgMinutes > 0)
      .reduce((acc, m) => acc + m.avgMinutes, 0) /
      Math.max(1, (metrics ?? []).filter((m) => m.avgMinutes > 0).length) || 0;

  const teamSize = team?.length ?? 0;
  const adminsOnline = team?.filter((t) => t.role === "admin").length ?? 0;

  const teamActivity = (metrics ?? [])
    .filter((m) => m.name !== "Não atribuídos" && m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxTotal = teamActivity[0]?.total ?? 1;

  // NPS aggregation
  const ratedTickets = (tickets ?? []).filter((t: any) => typeof t.nps_score === "number");
  const npsCount = ratedTickets.length;
  const npsAvg =
    npsCount > 0
      ? ratedTickets.reduce((acc: number, t: any) => acc + t.nps_score, 0) / npsCount
      : 0;
  const npsDist = [1, 2, 3, 4, 5].map((n) => ({
    n,
    count: ratedTickets.filter((t: any) => t.nps_score === n).length,
  }));
  const npsMaxBar = Math.max(1, ...npsDist.map((d) => d.count));

  const kpis = [
    {
      label: "Chamados Abertos",
      value: stats?.open ?? 0,
      hint: `${urgentes} urgentes`,
      icon: Inbox,
      tone: "text-foreground",
    },
    {
      label: "Resolvidos Hoje",
      value: resolvedToday,
      hint: "atualizado em tempo real",
      icon: CheckCircle2,
      tone: "text-foreground",
    },
    {
      label: "Tempo Médio",
      value: formatMinutes(Math.round(allAvg)),
      hint: "resolução",
      icon: Clock,
      tone: "text-foreground",
    },
    {
      label: "Equipe",
      value: teamSize,
      hint: `${adminsOnline} admins`,
      icon: Users,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema de TI</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-3xl font-display font-bold mt-3">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* NPS card */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            Satisfação dos Clientes (NPS)
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {npsCount} avaliação{npsCount !== 1 ? "ões" : ""}
          </span>
        </CardHeader>
        <CardContent className="pt-0">
          {npsCount === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma avaliação recebida ainda.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
              <div className="text-center">
                <p className="text-5xl font-display font-bold">{npsAvg.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">média de 5</p>
                <div className="flex justify-center mt-2 gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${
                        n <= Math.round(npsAvg)
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const item = npsDist.find((d) => d.n === n)!;
                  const pct = (item.count / npsMaxBar) * 100;
                  const color =
                    n >= 4 ? "bg-emerald-500" : n === 3 ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-6 tabular-nums text-muted-foreground">
                        {n}★
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums text-muted-foreground">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-column area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent tickets */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Chamados Recentes</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/chamados")}
              className="text-xs"
            >
              Ver todos <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum chamado ainda.
              </p>
            ) : (
              <div className="divide-y">
                {recent.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/ticket/${t.id}`)}
                    className="w-full grid grid-cols-[60px_1fr_auto_auto_auto] items-center gap-3 py-3 text-left hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <span className="text-xs font-mono text-muted-foreground">
                      {shortId(t.id)}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {t.subject || "Sem assunto"}
                    </span>
                    <Badge variant="outline" className={`text-[10px] status-${t.status} border-0`}>
                      {statusLabels[t.status]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] priority-${t.priority} border-0`}
                    >
                      {priorityLabels[t.priority]}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                      {relativeTime(t.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Resumo Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <Row icon={Inbox} label="Total de chamados" value={String(stats?.total ?? 0)} />
              <Row icon={Headphones} label="Em andamento" value={String(stats?.in_progress ?? 0)} />
              <Row
                icon={AlertTriangle}
                label="Urgentes em aberto"
                value={String(urgentes)}
                tone={urgentes > 0 ? "text-destructive" : undefined}
              />
              <Row icon={Users} label="Não atribuídos" value={String(stats?.unassigned ?? 0)} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Atividade da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {teamActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem atividade ainda</p>
              ) : (
                teamActivity.map((m) => (
                  <div key={m.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{m.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {m.total} chamado{m.total > 1 ? "s" : ""}
                      </span>
                    </div>
                    <Progress value={(m.total / maxTotal) * 100} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className={`font-semibold tabular-nums ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

function formatMinutes(min: number) {
  if (!min) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}