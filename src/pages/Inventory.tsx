
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
  FileText
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
      const { data, error } = await supabase
        .from("inventory_transfers")
        .select("*, inventory_items(name), origin:sectors!inventory_transfers_origin_sector_id_fkey(name, units(name)), destination:sectors!inventory_transfers_destination_sector_id_fkey(name, units(name))")
        .order("sent_at", { ascending: false });
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
      toast.success("Transferência registrada!");
      setIsTransferModalOpen(false);
    },
    onError: (error) => toast.error(`Erro na transferência: ${error.message}`)
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recebido": return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Recebido</Badge>;
      case "em_transito": return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" /> Em Trânsito</Badge>;
      case "pendente": return <Badge variant="secondary" className="bg-amber-100 text-amber-700"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Estoque & Logística</h1>
          <p className="text-slate-500">Controle de materiais e transferências intermunicipais</p>
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
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Nova Transferência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Transferência</DialogTitle>
                <DialogDescription>Mova materiais entre unidades e setores.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addTransferMutation.mutate({
                  item_id: formData.get("item_id"),
                  origin_sector_id: formData.get("origin_sector_id"),
                  destination_sector_id: formData.get("destination_sector_id"),
                  quantity: parseInt(formData.get("quantity") as string),
                  freight_cost: parseFloat(formData.get("freight_cost") as string || "0"),
                  carrier_name: formData.get("carrier_name"),
                  status: "em_transito"
                });
              }} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Item para Transferir</Label>
                  <Select name="item_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o item" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Origem (Setor)</Label>
                    <Select name="origin_sector_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="De onde sai?" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.units?.name} - {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Destino (Setor)</Label>
                    <Select name="destination_sector_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Para onde vai?" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.units?.name} - {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input name="quantity" type="number" min="1" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo do Frete (R$)</Label>
                    <Input name="freight_cost" type="number" step="0.01" placeholder="0,00" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Responsável pelo Transporte</Label>
                  <Input name="carrier_name" placeholder="Ex: Transportadora X ou Motorista" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addTransferMutation.isPending}>
                    {addTransferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Envio
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
                <p className="text-sm font-medium text-slate-500">Itens Cadastrados</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-900">{inventory.length}</h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Em Trânsito</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-900">
                  {transfers.filter(t => t.status === "em_transito").length}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                <Truck className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Custos Logísticos (Total)</p>
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
        <Card className="border-none shadow-sm group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Unidades Ativas</p>
                <h3 className="text-2xl font-bold mt-1 text-purple-900">{units.length}</h3>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <Building2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="bg-white border p-1 shadow-sm h-12">
          <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <Package className="w-4 h-4 mr-2" /> Catálogo de Materiais
          </TabsTrigger>
          <TabsTrigger value="transfers" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <Truck className="w-4 h-4 mr-2" /> Logística & Fretes
          </TabsTrigger>
          <TabsTrigger value="units" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <Building2 className="w-4 h-4 mr-2" /> Unidades e Setores
          </TabsTrigger>
        </TabsList>

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
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-normal">{item.category}</Badge></TableCell>
                        <TableCell className="text-slate-500 font-mono text-xs">{item.sku || "---"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Editar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
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

        <TabsContent value="transfers" className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Rastreio de Logística</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTransfers ? (
                <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Origem ➡️ Destino</TableHead>
                      <TableHead>Frete (R$)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transportadora</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow key={transfer.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900">
                          {transfer.inventory_items?.name}
                          <div className="text-[10px] text-slate-400">Qtd: {transfer.quantity}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{transfer.origin?.units?.name}</span>
                              <span className="text-[10px] text-slate-400">{transfer.origin?.name}</span>
                            </div>
                            <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                            <div className="flex flex-col text-primary">
                              <span className="font-medium">{transfer.destination?.units?.name}</span>
                              <span className="text-[10px] opacity-70">{transfer.destination?.name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600">
                          {transfer.freight_cost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{transfer.carrier_name || "---"}</TableCell>
                        <TableCell className="text-right">
                          {transfer.status !== 'recebido' && (
                            <Button variant="outline" size="sm" onClick={async () => {
                              const { error } = await supabase
                                .from("inventory_transfers")
                                .update({ status: 'recebido', received_at: new Date().toISOString() })
                                .eq("id", transfer.id);
                              if (error) toast.error("Erro ao confirmar recebimento");
                              else {
                                queryClient.invalidateQueries({ queryKey: ["inventory_transfers"] });
                                toast.success("Carga recebida com sucesso!");
                              }
                            }}>Receber</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
