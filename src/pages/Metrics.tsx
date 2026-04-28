import { useMetricsByMember } from "@/hooks/useTeam";
import { useTicketStats } from "@/hooks/useTickets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Metrics() {
  const { data: stats } = useTicketStats();
  const { data: byMember } = useMetricsByMember();

  const cards = [
    { label: "Total", value: stats?.total ?? 0, color: "bg-muted" },
    { label: "Abertos", value: stats?.open ?? 0, color: "bg-blue-500/10 text-blue-600" },
    { label: "Em andamento", value: stats?.in_progress ?? 0, color: "bg-amber-500/10 text-amber-600" },
    { label: "Resolvidos", value: stats?.resolved ?? 0, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Não atribuídos", value: stats?.unassigned ?? 0, color: "bg-rose-500/10 text-rose-600" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Métricas</h1>
        <p className="text-sm text-muted-foreground">Visão geral e desempenho por colaborador</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 px-2 py-0.5 rounded inline-block ${c.color}`}>
                {c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-4">Colaborador</th>
                  <th className="py-2 px-2">Total</th>
                  <th className="py-2 px-2">Abertos</th>
                  <th className="py-2 px-2">Em andamento</th>
                  <th className="py-2 px-2">Resolvidos</th>
                  <th className="py-2 px-2">Fechados</th>
                  <th className="py-2 px-2">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {byMember?.map((m) => (
                  <tr key={m.name} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{m.name}</td>
                    <td className="py-2 px-2">{m.total}</td>
                    <td className="py-2 px-2">{m.open}</td>
                    <td className="py-2 px-2">{m.in_progress}</td>
                    <td className="py-2 px-2">{m.resolved}</td>
                    <td className="py-2 px-2">{m.closed}</td>
                    <td className="py-2 px-2">
                      {m.avgMinutes > 0 ? (
                        <Badge variant="secondary">{formatMinutes(m.avgMinutes)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!byMember || byMember.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-muted-foreground">
                      Sem dados ainda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMinutes(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}