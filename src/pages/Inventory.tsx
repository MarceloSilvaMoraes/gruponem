
import { useState, useEffect } from "react";
import { 
  Package, 
  Truck, 
  Plus, 
  Search, 
  ArrowRightLeft, 
  Building2, 
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  ShieldCheck,
  Ship,
  Anchor,
  ArrowRight,
  Printer,
  Monitor,
  History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Inventory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Queries para buscar dados reais do banco
  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*, units(name)");
      if (error) throw error;
      return data;
    }
  });

  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: transfers = [], isLoading: loadingTransfers } = useQuery({
    queryKey: ["inventory_transfers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_transfers")
        .select("*, inventory_items(name), origin:sectors!inventory_transfers_origin_sector_id_fkey(name, units(name)), destination:sectors!inventory_transfers_destination_sector_id_fkey(name, units(name))")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: equipmentList = [] } = useQuery({
    queryKey: ["equipment_list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("equipment").select("id, name, serial_number");
      if (error) throw error;
      return data;
    }
  });

  const { data: stockLevels = [] } = useQuery({
    queryKey: ["stock_levels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("stock_levels").select("*, sectors(name, units(name))");
      if (error) throw error;
      return data;
    }
  });

  // Mutations para salvar dados
  const addItemMutation = useMutation({
    mutationFn: async (newItem: any) => {
      const { data, error } = await supabase.from("inventory_items").insert([newItem]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("Item cadastrado com sucesso!");
      setIsItemModalOpen(false);
    },
    onError: (error) => toast.error(`Erro ao cadastrar: ${error.message}`)
  });

  const addTransferMutation = useMutation({
    mutationFn: async (transfer: any) => {
      const { data, error } = await supabase.from("inventory_transfers").insert([transfer]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_transfers"] });
      toast.success("Solicitação enviada para o Fluxo!");
      setIsTransferModalOpen(false);
    },
    onError: (error) => toast.error(`Erro na solicitação: ${error.message}`)
  });

  const updateTransferStatus = useMutation({
    mutationFn: async ({ id, status, updates = {} }: { id: string, status: string, updates?: any }) => {
      if (status === 'recebido') {
        // Fallback frontend logic since user doesn't have DB access to create RPCs
        const { data: tData } = await (supabase as any).from("inventory_transfers").select("*").eq("id", id).single();
        if (tData) {
          if (tData.item_id) {
            // Origin
            const { data: originStock } = await (supabase as any).from("stock_levels").select("*").eq("item_id", tData.item_id).eq("sector_id", tData.origin_sector_id).maybeSingle();
            if (originStock) {
              await (supabase as any).from("stock_levels").update({ quantity: Math.max(0, originStock.quantity - tData.quantity) }).eq("id", originStock.id);
            }
            // Destination
            const { data: destStock } = await (supabase as any).from("stock_levels").select("*").eq("item_id", tData.item_id).eq("sector_id", tData.destination_sector_id).maybeSingle();
            if (destStock) {
              await (supabase as any).from("stock_levels").update({ quantity: destStock.quantity + tData.quantity }).eq("id", destStock.id);
            } else {
              await (supabase as any).from("stock_levels").insert([{ item_id: tData.item_id, sector_id: tData.destination_sector_id, quantity: tData.quantity }]);
            }
          }
          if (tData.notes && tData.notes.includes("equipment_id")) {
            try {
              const parsed = JSON.parse(tData.notes);
              if (parsed.equipment_id) {
                const { data: eq } = await (supabase as any).from("equipment").select("notes").eq("id", parsed.equipment_id).single();
                if (eq) {
                  await (supabase as any).from("equipment").update({ notes: (eq.notes || "") + " [Recebido via Logística]" }).eq("id", parsed.equipment_id);
                }
              }
            } catch(e) {}
          }
        }
      }
      const { data, error } = await supabase
        .from("inventory_transfers")
        .update({ status, ...updates })
        .eq("id", id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["stock_levels"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => toast.error(`Erro ao atualizar: ${error.message}`)
  });

  const printReceipt = (t: any) => {
    let equipName = null;
    let equipSerial = "-";
    if (t.notes && t.notes.includes("equipment_id")) {
      try {
        const parsed = JSON.parse(t.notes);
        const eq = equipmentList.find((e: any) => e.id === parsed.equipment_id);
        if (eq) { equipName = eq.name; equipSerial = eq.serial_number || "-"; }
      } catch (e) {}
    }
    
    const itemName = t.inventory_items?.name || equipName || "Item Indefinido";
    const qty = equipName ? 1 : (t.quantity || 1);
    
    const content = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ccc;">
        <h2 style="text-align: center;">GUIA DE REMESSA DE MATERIAL</h2>
        <hr/>
        <p><strong>Origem:</strong> ${t.origin?.units?.name} - ${t.origin?.name}</p>
        <p><strong>Destino:</strong> ${t.destination?.units?.name} - ${t.destination?.name}</p>
        <p><strong>Data de Envio:</strong> ${new Date(t.sent_at).toLocaleDateString()}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <th style="border: 1px solid #ccc; padding: 8px;">Qtd</th>
            <th style="border: 1px solid #ccc; padding: 8px;">Descrição do Item</th>
            <th style="border: 1px solid #ccc; padding: 8px;">Série/SKU</th>
          </tr>
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${qty}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">${itemName}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">${equipSerial}</td>
          </tr>
        </table>
        <div style="margin-top: 30px;">
          <p><strong>Logística:</strong> Embarcação ${t.vessel_name || '-'} / Porto: ${t.port_name || '-'}</p>
          <p><strong>Valor do Frete:</strong> R$ ${t.freight_cost || '0.00'}</p>
        </div>
        <div style="margin-top: 60px; text-align: center;">
          <p>_________________________________________________</p>
          <p>Assinatura do Transportador / Responsável</p>
        </div>
      </div>
    `;
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recebido": return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Recebido</Badge>;
      case "em_transito": return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><Ship className="w-3 h-3 mr-1" /> No Rio/Caminho</Badge>;
      case "liberado_logistica": return <Badge variant="secondary" className="bg-purple-100 text-purple-700"><Anchor className="w-3 h-3 mr-1" /> Pronto p/ Porto</Badge>;
      case "aguardando_aprovacao": return <Badge variant="secondary" className="bg-amber-100 text-amber-700"><ShieldCheck className="w-3 h-3 mr-1" /> Aprovação Pendente</Badge>;
      case "cotacao": return <Badge variant="secondary" className="bg-rose-100 text-rose-700"><FileText className="w-3 h-3 mr-1" /> Em Cotação</Badge>;
      case "pendente": return <Badge variant="secondary" className="bg-slate-100 text-slate-700"><Clock className="w-3 h-3 mr-1" /> Solicitado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Estoque & Logística</h1>
          <p className="text-slate-500">Gestão de materiais e fluxo de aprovação intermunicipal</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Material</DialogTitle>
                <DialogDescription>Adicione um novo item ao catálogo geral do estoque.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addItemMutation.mutate({
                  name: formData.get("name"),
                  category: formData.get("category"),
                  description: formData.get("description"),
                  sku: formData.get("sku") || undefined
                });
              }} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Material</Label>
                  <Input id="name" name="name" placeholder="Ex: Roteador MikroTik" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select name="category" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rede">Rede</SelectItem>
                        <SelectItem value="Periféricos">Periféricos</SelectItem>
                        <SelectItem value="Cabeamento">Cabeamento</SelectItem>
                        <SelectItem value="Computadores">Computadores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">Código/SKU (Opcional)</Label>
                    <Input id="sku" name="sku" placeholder="Ex: MK-001" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input id="description" name="description" placeholder="Detalhes técnicos..." />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addItemMutation.isPending}>
                    {addItemMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Item
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <FileText className="w-4 h-4 mr-2" /> Importar Planilha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Itens via CSV</DialogTitle>
                <DialogDescription>Suba uma planilha com seus materiais para cadastro em massa.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-dashed border-slate-300">
                  <p className="text-sm font-medium text-slate-700 mb-2">Instruções:</p>
                  <ul className="text-xs text-slate-500 space-y-1 list-disc ml-4">
                    <li>Use formato CSV (separado por vírgulas).</li>
                    <li>Colunas necessárias: <code className="bg-slate-200 px-1 rounded">nome, categoria, descricao, sku</code></li>
                    <li>A categoria deve ser uma das existentes (Rede, Periféricos, etc).</li>
                  </ul>
                  <Button variant="link" className="text-xs p-0 h-auto mt-2 text-primary" onClick={() => {
                    const csvContent = "nome,categoria,descricao,sku\nExemplo Teclado,Periféricos,Teclado Mecânico USB,SKU001\nExemplo Roteador,Rede,Roteador WiFi 6,SKU002";
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('hidden', '');
                    a.setAttribute('href', url);
                    a.setAttribute('download', 'modelo_estoque.csv');
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}>
                    Baixar Modelo de Exemplo
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="csvFile">Selecione o arquivo .csv</Label>
                  <Input id="csvFile" type="file" accept=".csv" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const text = event.target?.result as string;
                      const rows = text.split("\n").slice(1); // Ignora o cabeçalho
                      const items = rows.map(row => {
                        const [name, category, description, sku] = row.split(",").map(s => s.trim());
                        if (!name) return null;
                        return { name, category, description, sku };
                      }).filter(Boolean);

                      if (items.length > 0) {
                        const { error } = await supabase.from("inventory_items").insert(items);
                        if (error) toast.error(`Erro na importação: ${error.message}`);
                        else {
                          queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
                          toast.success(`${items.length} itens importados com sucesso!`);
                        }
                      }
                    };
                    reader.readAsText(file);
                  }} />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Nova Solicitação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Solicitar Envio de Material</DialogTitle>
                <DialogDescription>Inicie o fluxo de envio para uma unidade/setor.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const itemId = formData.get("item_id");
                const equipId = formData.get("equipment_id");
                
                if (itemId === "none" && equipId === "none") {
                  toast.error("Selecione um material ou um patrimônio!");
                  return;
                }

                addTransferMutation.mutate({
                  item_id: itemId !== "none" ? itemId : null,
                  notes: equipId !== "none" ? JSON.stringify({ equipment_id: equipId }) : null,
                  origin_sector_id: formData.get("origin_sector_id"),
                  destination_sector_id: formData.get("destination_sector_id"),
                  quantity: equipId !== "none" ? 1 : parseInt(formData.get("quantity") as string),
                  status: "aguardando_aprovacao"
                });
              }} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Item Solicitado (Estoque Quantitativo)</Label>
                  <Select name="item_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o material de estoque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Nenhum (Usar Patrimônio) --</SelectItem>
                      {inventory.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>OU Patrimônio Específico (Opcional)</Label>
                  <Select name="equipment_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um patrimônio (se houver)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Nenhum --</SelectItem>
                      {equipmentList.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.serial_number || 'Sem série'})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>De (Setor de Saída)</Label>
                    <Select name="origin_sector_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.units?.name} - {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Para (Destino)</Label>
                    <Select name="destination_sector_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.units?.name} - {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input name="quantity" type="number" min="1" required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addTransferMutation.isPending}>
                    {addTransferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar para Aprovação
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Pedidos p/ Aprovar</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-600">
                  {transfers.filter(t => t.status === "aguardando_aprovacao").length}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Prontos p/ Porto</p>
                <h3 className="text-2xl font-bold mt-1 text-purple-600">
                  {transfers.filter(t => t.status === "liberado_logistica").length}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <Anchor className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Em Trânsito (Rio)</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-600">
                  {transfers.filter(t => t.status === "em_transito").length}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <Ship className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Gasto Frete (Mês)</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                  R$ {transfers.reduce((acc, curr) => acc + (curr.freight_cost || 0), 0).toFixed(2)}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workflow" className="space-y-6">
        <TabsList className="bg-white border p-1 shadow-sm h-12">
          <TabsTrigger value="workflow" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Fluxo de Envio
          </TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <Package className="w-4 h-4 mr-2" /> Catálogo Geral
          </TabsTrigger>
          <TabsTrigger value="units" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <Building2 className="w-4 h-4 mr-2" /> Unidades e Setores
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <History className="w-4 h-4 mr-2" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUNA 1: AGUARDANDO APROVAÇÃO */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-bold text-slate-700 flex items-center"><ShieldCheck className="w-4 h-4 mr-2 text-amber-500" /> Aprovação (Financeiro/CEO)</h3>
                <Badge variant="outline">{transfers.filter(t => t.status === "aguardando_aprovacao").length}</Badge>
              </div>
              <div className="space-y-3">
                {transfers.filter(t => t.status === "aguardando_aprovacao").map(t => (
                  <Card key={t.id} className="border-l-4 border-l-amber-400 shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900">
                          {t.notes && t.notes.includes("equipment_id") ? <Monitor className="inline w-4 h-4 mr-1 text-primary"/> : null}
                          {t.inventory_items?.name || (t.notes && t.notes.includes("equipment_id") ? (() => {
                            try { return equipmentList.find((e:any) => e.id === JSON.parse(t.notes).equipment_id)?.name; } catch(e) { return 'Patrimônio'; }
                          })() : 'Item')}
                        </span>
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded">Qtd: {t.quantity}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {t.origin?.units?.name} ➡️ {t.destination?.units?.name}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => updateTransferStatus.mutate({ id: t.id, status: 'liberado_logistica' })}>Aprovar Envio</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-600 hover:text-rose-700" onClick={() => updateTransferStatus.mutate({ id: t.id, status: 'cancelado' })}>Recusar</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {transfers.filter(t => t.status === "aguardando_aprovacao").length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs border border-dashed rounded-lg">Nenhum pedido pendente de aprovação.</div>
                )}
              </div>
            </div>

            {/* COLUNA 2: LOGÍSTICA / PORTO */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-bold text-slate-700 flex items-center"><Anchor className="w-4 h-4 mr-2 text-purple-500" /> Logística (Porto/Frete)</h3>
                <Badge variant="outline">{transfers.filter(t => t.status === "liberado_logistica").length}</Badge>
              </div>
              <div className="space-y-3">
                {transfers.filter(t => t.status === "liberado_logistica").map(t => (
                  <Card key={t.id} className="border-l-4 border-l-purple-400 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900">
                          {t.notes && t.notes.includes("equipment_id") ? <Monitor className="inline w-4 h-4 mr-1 text-primary"/> : null}
                          {t.inventory_items?.name || (t.notes && t.notes.includes("equipment_id") ? (() => {
                            try { return equipmentList.find((e:any) => e.id === JSON.parse(t.notes).equipment_id)?.name; } catch(e) { return 'Patrimônio'; }
                          })() : 'Item')}
                        </span>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">Aprovado</Badge>
                      </div>
                      <Dialog>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => printReceipt(t)}>
                            <Printer className="w-3 h-3 mr-1" /> Guia
                          </Button>
                          <DialogTrigger asChild>
                            <Button size="sm" className="flex-2 h-8 text-xs bg-slate-800 hover:bg-slate-900 text-white">
                              <Ship className="w-3 h-3 mr-1" /> Logística
                            </Button>
                          </DialogTrigger>
                        </div>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Detalhes da Logística</DialogTitle></DialogHeader>
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            updateTransferStatus.mutate({ 
                              id: t.id, 
                              status: 'em_transito',
                              updates: {
                                port_name: formData.get("port_name"),
                                vessel_name: formData.get("vessel_name"),
                                freight_cost: parseFloat(formData.get("freight_cost") as string),
                                carrier_name: formData.get("carrier_name")
                              }
                            });
                          }} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Porto de Saída</Label>
                                <Input name="port_name" placeholder="Ex: Porto da Escadinha" required />
                              </div>
                              <div className="space-y-2">
                                <Label>Embarcação</Label>
                                <Input name="vessel_name" placeholder="Ex: B/M Silva" required />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Valor do Frete (R$)</Label>
                              <Input name="freight_cost" type="number" step="0.01" required />
                            </div>
                            <Button type="submit" className="w-full">Confirmar Saída do Barco</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                ))}
                {transfers.filter(t => t.status === "liberado_logistica").length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs border border-dashed rounded-lg">Nada liberado para logística no momento.</div>
                )}
              </div>
            </div>

            {/* COLUNA 3: EM TRÂNSITO / RECEBER */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-bold text-slate-700 flex items-center"><Ship className="w-4 h-4 mr-2 text-blue-500" /> Em Trânsito (Rio/Caminho)</h3>
                <Badge variant="outline">{transfers.filter(t => t.status === "em_transito").length}</Badge>
              </div>
              <div className="space-y-3">
                {transfers.filter(t => t.status === "em_transito").map(t => (
                  <Card key={t.id} className="border-l-4 border-l-blue-400 shadow-sm bg-blue-50/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900">
                          {t.notes && t.notes.includes("equipment_id") ? <Monitor className="inline w-4 h-4 mr-1 text-primary"/> : null}
                          {t.inventory_items?.name || (t.notes && t.notes.includes("equipment_id") ? (() => {
                            try { return equipmentList.find((e:any) => e.id === JSON.parse(t.notes).equipment_id)?.name; } catch(e) { return 'Patrimônio'; }
                          })() : 'Item')}
                        </span>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-emerald-600">Frete: R$ {t.freight_cost}</p>
                        </div>
                      </div>
                      <div className="text-[10px] space-y-1 bg-white p-2 rounded border">
                        <p className="flex justify-between"><span>Barco:</span> <span className="font-bold">{t.vessel_name}</span></p>
                        <p className="flex justify-between"><span>Porto:</span> <span className="font-bold">{t.port_name}</span></p>
                        <p className="flex justify-between"><span>Destino:</span> <span className="font-bold text-primary">{t.destination?.units?.municipality}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs bg-white hover:bg-slate-50" onClick={() => printReceipt(t)}>
                          <Printer className="w-3 h-3" />
                        </Button>
                        <Button size="sm" className="flex-[3] bg-slate-800 hover:bg-slate-900 h-8 text-xs" onClick={() => updateTransferStatus.mutate({ id: t.id, status: 'recebido' })}>
                          Confirmar Recebimento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {transfers.filter(t => t.status === "em_transito").length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs border border-dashed rounded-lg">Nenhuma carga em trânsito.</div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <CardTitle className="text-lg">Inventário Geral</CardTitle>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Buscar material..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingInventory ? (
                <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Saldos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => {
                      const itemBalances = stockLevels.filter(s => s.item_id === item.id);
                      const totalStock = itemBalances.reduce((acc, curr) => acc + curr.quantity, 0);
                      
                      return (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-normal">{item.category}</Badge></TableCell>
                        <TableCell className="text-slate-500 font-mono text-xs">{item.sku || "---"}</TableCell>
                        <TableCell className="text-right">
                          {totalStock > 0 ? (
                            <div className="text-xs">
                              <span className="font-bold text-emerald-600">{totalStock} em estoque</span>
                              {itemBalances.map(b => (
                                <div key={b.id} className="text-slate-500 text-[10px] mt-0.5">
                                  {b.sectors?.units?.name}: {b.quantity}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-rose-500 font-medium">Sem Estoque</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Editar</Button>
                        </TableCell>
                      </TableRow>
                    )})}
                    {inventory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">Nenhum item cadastrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Histórico de Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Item / Patrimônio</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Logística</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.filter((t: any) => t.status === 'recebido' || t.status === 'cancelado').length > 0 ? (
                      transfers.filter((t: any) => t.status === 'recebido' || t.status === 'cancelado').map((t: any) => (
                        <TableRow key={t.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-xs text-slate-500">
                            {new Date(t.updated_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {t.notes && t.notes.includes("equipment_id") ? <Monitor className="inline w-3 h-3 mr-1 text-primary"/> : null}
                            {t.inventory_items?.name || (t.notes && t.notes.includes("equipment_id") ? (() => {
                              try { return equipmentList.find((e:any) => e.id === JSON.parse(t.notes).equipment_id)?.name; } catch(e) { return 'Patrimônio'; }
                            })() : 'Item')}
                            <span className="ml-2 text-xs text-slate-500">(Qtd: {t.quantity})</span>
                          </TableCell>
                          <TableCell className="text-xs">{t.origin?.units?.name} - {t.origin?.name}</TableCell>
                          <TableCell className="text-xs">{t.destination?.units?.name} - {t.destination?.name}</TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {t.vessel_name ? `Embarcação: ${t.vessel_name}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={t.status === 'recebido' ? 'default' : 'destructive'}>{t.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          Nenhum histórico encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center"><Building2 className="w-4 h-4 mr-2" /> Unidades Cadastradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {units.map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-white border rounded-lg">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.municipality}</p>
                        </div>
                      </div>
                    ))}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-dashed">Adicionar Unidade</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nova Unidade</DialogTitle></DialogHeader>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const { error } = await supabase.from("units").insert([{
                            name: formData.get("name"),
                            municipality: formData.get("municipality")
                          }]);
                          if (error) toast.error("Erro ao criar unidade");
                          else {
                            queryClient.invalidateQueries({ queryKey: ["units"] });
                            toast.success("Unidade criada!");
                          }
                        }} className="space-y-4 py-4">
                          <Input name="name" placeholder="Nome da Unidade (Ex: Sede)" required />
                          <Input name="municipality" placeholder="Município" required />
                          <Button type="submit" className="w-full">Salvar Unidade</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><MapPin className="w-4 h-4 mr-2" /> Setores por Unidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sectors.map(s => (
                      <div key={s.id} className="flex justify-between items-center p-3 bg-white border rounded-lg">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-slate-500">Unidade: {s.units?.name}</p>
                        </div>
                      </div>
                    ))}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-dashed">Adicionar Setor</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Novo Setor</DialogTitle></DialogHeader>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const { error } = await supabase.from("sectors").insert([{
                            name: formData.get("name"),
                            unit_id: formData.get("unit_id")
                          }]);
                          if (error) toast.error("Erro ao criar setor");
                          else {
                            queryClient.invalidateQueries({ queryKey: ["sectors"] });
                            toast.success("Setor criado!");
                          }
                        }} className="space-y-4 py-4">
                          <Input name="name" placeholder="Nome do Setor (Ex: T.I)" required />
                          <Select name="unit_id" required>
                            <SelectTrigger><SelectValue placeholder="Selecione a Unidade" /></SelectTrigger>
                            <SelectContent>
                              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button type="submit" className="w-full">Salvar Setor</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;
