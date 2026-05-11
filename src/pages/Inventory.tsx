
import { useState } from "react";
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
  AlertCircle
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

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState("");

  // Dados Mockados para demonstração inicial
  const stats = [
    { title: "Itens em Estoque", value: "1,284", icon: Package, color: "text-blue-600" },
    { title: "Em Trânsito", value: "12", icon: Truck, color: "text-amber-600" },
    { title: "Frete Total (Mês)", value: "R$ 1.450,00", icon: TrendingUp, color: "text-emerald-600" },
    { title: "Unidades Ativas", value: "4", icon: Building2, color: "text-purple-600" },
  ];

  const mockInventory = [
    { id: 1, name: "Roteador MikroTik RB750", category: "Rede", total: 45, unit: "Sede Belém", sector: "Almoxarifado" },
    { id: 2, name: "Cabo Patch Cord 1.5m CAT6", category: "Cabeamento", total: 120, unit: "Sede Belém", sector: "T.I" },
    { id: 3, name: "Teclado Mecânico Logitech", category: "Periféricos", total: 15, unit: "Filial Marabá", sector: "Administrativo" },
    { id: 4, name: "Switch TP-Link 24p", category: "Rede", total: 8, unit: "Filial Ananindeua", sector: "Suporte" },
  ];

  const mockTransfers = [
    { id: "T1", item: "Roteador MikroTik", from: "Sede Belém", to: "Filial Marabá", cost: "R$ 120,00", status: "Em Trânsito", date: "10/05/2026" },
    { id: "T2", item: "Switch TP-Link", from: "Sede Belém", to: "Filial Castanhal", cost: "R$ 85,00", status: "Recebido", date: "08/05/2026" },
    { id: "T3", item: "Notebook Dell Vostro", from: "Sede Belém", to: "Filial Marabá", cost: "R$ 150,00", status: "Pendente", date: "11/05/2026" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Recebido": return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" /> Recebido</Badge>;
      case "Em Trânsito": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Clock className="w-3 h-3 mr-1" /> Em Trânsito</Badge>;
      case "Pendente": return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
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
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> Novo Item
          </Button>
          <Button variant="outline">
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Nova Transferência
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-900">{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-xl bg-slate-50 group-hover:scale-110 transition-transform ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="bg-white border p-1 shadow-sm h-12">
          <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">
            <Package className="w-4 h-4 mr-2" /> Inventário
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
                <CardTitle className="text-lg">Materiais em Estoque</CardTitle>
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
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockInventory.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                      <TableCell><Badge variant="outline" className="font-normal">{item.category}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium flex items-center"><MapPin className="w-3 h-3 mr-1 text-slate-400" /> {item.unit}</span>
                          <span className="text-xs text-slate-500 ml-4">{item.sector}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{item.total}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-primary">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Histórico de Transferências Intermunicipais</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Origem ➡️ Destino</TableHead>
                    <TableHead>Custo Frete</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">{transfer.item}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="font-medium">{transfer.from}</span>
                          <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                          <span className="font-medium text-primary">{transfer.to}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600">{transfer.cost}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{transfer.date}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">Ver Detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><Building2 className="w-4 h-4 mr-2" /> Unidades Cadastradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">Gerencie os locais físicos da empresa.</p>
                  {/* Lista de unidades viria aqui */}
                  <Button variant="outline" className="mt-4 w-full border-dashed">Adicionar Unidade</Button>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><MapPin className="w-4 h-4 mr-2" /> Setores por Unidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">Defina os departamentos dentro de cada unidade.</p>
                  {/* Lista de setores viria aqui */}
                  <Button variant="outline" className="mt-4 w-full border-dashed">Adicionar Setor</Button>
                </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;
