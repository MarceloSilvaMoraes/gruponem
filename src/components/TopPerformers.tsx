import { Trophy, CheckCircle2, Timer } from "lucide-react";
import { useMetricsByMember } from "@/hooks/useTeam";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatMinutes(min: number) {
  if (!min) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

type Row = {
  name: string;
  total: number;
  resolved: number;
  avgMinutes: number;
};

function Podium({
  title,
  icon: Icon,
  rows,
  metricLabel,
  formatValue,
  color,
}: {
  title: string;
  icon: typeof Trophy;
  rows: Row[];
  metricLabel: string;
  formatValue: (r: Row) => string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Sem dados ainda</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2 text-sm">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background:
                      i === 0
                        ? "hsl(45 90% 55% / 0.2)"
                        : i === 1
                          ? "hsl(0 0% 70% / 0.2)"
                          : "hsl(25 60% 50% / 0.2)",
                    color:
                      i === 0
                        ? "hsl(38 90% 40%)"
                        : i === 1
                          ? "hsl(0 0% 35%)"
                          : "hsl(25 70% 35%)",
                  }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{r.name}</span>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {formatValue(r)} {metricLabel}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function TopPerformers() {
  const { data } = useMetricsByMember();

  const members = (data ?? []).filter(
    (m) => m.name !== "Não atribuídos" && m.total > 0,
  );

  const byTotal = [...members].sort((a, b) => b.total - a.total).slice(0, 3);
  const byResolved = [...members]
    .sort((a, b) => b.resolved - a.resolved)
    .filter((m) => m.resolved > 0)
    .slice(0, 3);
  const byTime = [...members]
    .filter((m) => m.avgMinutes > 0)
    .sort((a, b) => a.avgMinutes - b.avgMinutes)
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Podium
        title="Mais chamados atendidos"
        icon={Trophy}
        rows={byTotal}
        metricLabel="chamados"
        formatValue={(r) => String(r.total)}
        color="hsl(45 90% 50%)"
      />
      <Podium
        title="Mais chamados resolvidos"
        icon={CheckCircle2}
        rows={byResolved}
        metricLabel="resolvidos"
        formatValue={(r) => String(r.resolved)}
        color="hsl(142 70% 45%)"
      />
      <Podium
        title="Resolução mais rápida"
        icon={Timer}
        rows={byTime}
        metricLabel="médio"
        formatValue={(r) => formatMinutes(r.avgMinutes)}
        color="hsl(217 90% 55%)"
      />
    </div>
  );
}