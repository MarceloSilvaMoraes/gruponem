import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, CheckCircle2, XCircle, ShoppingCart, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  comprado: "Comprado",
};

const STATUS_VARIANT: Record<string, string> = {
  pendente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  aprovado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  recusado: "bg-red-500/15 text-red-700 dark:text-red-400",
  comprado: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export default function Orcamentos() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: budgets } = useQuery({
    queryKey: ["budgets", filter],
    queryFn: async () => {
      let q = supabase.from("budgets").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: string) => {
    const update: any = { status };
    if (status === "aprovado") {
      update.approved_by = user?.id;
      update.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("budgets").update(update).eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["budgets"] });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const totals = (budgets ?? []).reduce(
    (acc, b: any) => {
      acc.count++;
      acc.value += Number(b.estimated_value ?? 0);
      acc.byStatus[b.status] = (acc.byStatus[b.status] ?? 0) + 1;
      return acc;
    },
    { count: 0, value: 0, byStatus: {} as Record<string, number> },
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Pedidos recebidos via Typebot/WhatsApp
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="recusado">Recusados</SelectItem>
            <SelectItem value="comprado">Comprados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.count}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.byStatus.pendente ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Aprovados</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.byStatus.aprovado ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor estimado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totals.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {(budgets ?? []).map((b: any) => (
          <Card key={b.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{b.item}</h3>
                    <Badge className={STATUS_VARIANT[b.status] ?? "bg-muted"}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Solicitado por {b.requester_name ?? "—"}
                    {b.requester_sector ? ` (${b.requester_sector})` : ""}
                    {b.requester_phone ? ` • ${b.requester_phone}` : ""}
                    {" • "}
                    {format(new Date(b.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">Qtd: <strong>{b.quantity ?? 1}</strong></p>
                  {b.estimated_value != null && (
                    <p className="text-sm">
                      {Number(b.estimated_value).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  )}
                </div>
              </div>
              {(b.supplier || b.justification) && (
                <div className="text-sm space-y-1">
                  {b.supplier && <p><span className="text-muted-foreground">Fornecedor:</span> {b.supplier}</p>}
                  {b.justification && (
                    <p><span className="text-muted-foreground">Justificativa:</span> {b.justification}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2 flex-wrap pt-1 border-t">
                <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "aprovado")}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "recusado")}>
                  <XCircle className="h-3.5 w-3.5" /> Recusar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "comprado")}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Marcar comprado
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "pendente")}>
                  Reabrir
                </Button>
                {role === "admin" && (
                  <Button size="sm" variant="destructive" className="ml-auto" onClick={() => remove(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(budgets ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhum orçamento {filter !== "all" ? `(${STATUS_LABEL[filter]?.toLowerCase()})` : ""} ainda
          </p>
        )}
      </div>
    </div>
  );
}