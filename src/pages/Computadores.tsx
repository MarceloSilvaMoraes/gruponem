import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Monitor, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Computer = {
  id: string;
  name: string;
  hostname: string | null;
  ip_address: string | null;
  mac_address: string | null;
  sector: string | null;
  responsible: string | null;
  operating_system: string | null;
  status: string;
  notes: string | null;
};

type FormState = Omit<Computer, "id">;

const emptyForm: FormState = {
  name: "",
  hostname: "",
  ip_address: "",
  mac_address: "",
  sector: "",
  responsible: "",
  operating_system: "",
  status: "active",
  notes: "",
};

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  maintenance: { label: "Manutenção", variant: "secondary" },
  inactive: { label: "Inativo", variant: "outline" },
  broken: { label: "Com defeito", variant: "destructive" },
};

export default function Computadores() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Computer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: computers = [], isLoading } = useQuery({
    queryKey: ["computers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("computers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Computer[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      const clean = {
        ...payload,
        hostname: payload.hostname || null,
        ip_address: payload.ip_address || null,
        mac_address: payload.mac_address || null,
        sector: payload.sector || null,
        responsible: payload.responsible || null,
        operating_system: payload.operating_system || null,
        notes: payload.notes || null,
      };
      if (payload.id) {
        const { id, ...rest } = clean as any;
        const { error } = await supabase.from("computers").update(rest).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("computers").insert(clean);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["computers"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success("Computador salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("computers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["computers"] });
      toast.success("Computador removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const filtered = computers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.hostname?.toLowerCase().includes(q) ||
      c.ip_address?.toLowerCase().includes(q) ||
      c.sector?.toLowerCase().includes(q) ||
      c.responsible?.toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Computer) => {
    setEditing(c);
    setForm({
      name: c.name,
      hostname: c.hostname || "",
      ip_address: c.ip_address || "",
      mac_address: c.mac_address || "",
      sector: c.sector || "",
      responsible: c.responsible || "",
      operating_system: c.operating_system || "",
      status: c.status,
      notes: c.notes || "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }
    upsert.mutate(editing ? { ...form, id: editing.id } : form);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Computadores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Inventário manual dos equipamentos da rede
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar computador" : "Novo computador"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: PC-Recepção-01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hostname</Label>
                <Input
                  value={form.hostname || ""}
                  onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sistema Operacional</Label>
                <Input
                  value={form.operating_system || ""}
                  onChange={(e) => setForm({ ...form, operating_system: e.target.value })}
                  placeholder="Ex.: Windows 11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>IP</Label>
                <Input
                  value={form.ip_address || ""}
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                  placeholder="192.168.0.10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>MAC</Label>
                <Input
                  value={form.mac_address || ""}
                  onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Input
                  value={form.sector || ""}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  placeholder="Ex.: Comercial"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Input
                  value={form.responsible || ""}
                  onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="broken">Com defeito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-3 border-b">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, IP, setor..."
              className="pl-9"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Monitor className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum computador cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Adicionar" para começar o inventário
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">IP</TableHead>
                <TableHead className="hidden md:table-cell">Setor</TableHead>
                <TableHead className="hidden lg:table-cell">Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const s = statusLabel[c.status] || statusLabel.active;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        {c.hostname && (
                          <span className="text-xs text-muted-foreground">{c.hostname}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {c.ip_address || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{c.sector || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{c.responsible || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {role === "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover "${c.name}"?`)) remove.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}