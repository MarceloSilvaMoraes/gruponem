import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2, MapPin, Monitor, Tv, Wind, Projector, Box } from "lucide-react";
import { toast } from "sonner";

type Environment = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  notes: string | null;
};

type Equipment = {
  id: string;
  environment_id: string;
  type: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  notes: string | null;
};

const ENV_TYPES = [
  { value: "sala", label: "Sala de aula" },
  { value: "auditorio", label: "Auditório" },
  { value: "laboratorio", label: "Laboratório" },
  { value: "outro", label: "Outro" },
];

const EQUIP_TYPES = [
  { value: "computador", label: "Computador", icon: Monitor },
  { value: "tv", label: "TV", icon: Tv },
  { value: "ar_condicionado", label: "Ar-condicionado", icon: Wind },
  { value: "projetor", label: "Projetor", icon: Projector },
  { value: "outro", label: "Outro", icon: Box },
];

function equipIcon(type: string) {
  return EQUIP_TYPES.find((t) => t.value === type)?.icon ?? Box;
}

export default function Ambientes() {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "attendant";
  const qc = useQueryClient();
  const [envOpen, setEnvOpen] = useState(false);
  const [equipOpen, setEquipOpen] = useState<string | null>(null);
  const [envForm, setEnvForm] = useState({ name: "", type: "sala", location: "", notes: "" });
  const [equipForm, setEquipForm] = useState({
    type: "computador",
    name: "",
    brand: "",
    model: "",
    serial_number: "",
    status: "ativo",
    notes: "",
  });

  const { data: environments } = useQuery({
    queryKey: ["environments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("environments")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Environment[];
    },
  });

  const { data: equipment } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("equipment")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const createEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await (supabase as any).from("environments").insert(envForm);
    if (error) return toast.error("Erro ao criar ambiente", { description: error.message });
    toast.success("Ambiente criado");
    setEnvForm({ name: "", type: "sala", location: "", notes: "" });
    setEnvOpen(false);
    qc.invalidateQueries({ queryKey: ["environments"] });
  };

  const createEquip = async (envId: string, e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await (supabase as any)
      .from("equipment")
      .insert({ ...equipForm, environment_id: envId });
    if (error) return toast.error("Erro ao adicionar", { description: error.message });
    toast.success("Equipamento adicionado");
    setEquipForm({
      type: "computador",
      name: "",
      brand: "",
      model: "",
      serial_number: "",
      status: "ativo",
      notes: "",
    });
    setEquipOpen(null);
    qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  const deleteEnv = async (id: string) => {
    if (!confirm("Excluir este ambiente e todos os seus equipamentos?")) return;
    const { error } = await (supabase as any).from("environments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["environments"] });
    qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  const deleteEquip = async (id: string) => {
    const { error } = await (supabase as any).from("equipment").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ambientes</h1>
          <p className="text-sm text-muted-foreground">
            Mapeie salas, laboratórios e auditórios e seus equipamentos
          </p>
        </div>
        {canManage && (
          <Dialog open={envOpen} onOpenChange={setEnvOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo ambiente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo ambiente</DialogTitle>
              </DialogHeader>
              <form onSubmit={createEnv} className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    required
                    value={envForm.name}
                    onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
                    placeholder="Ex: Sala 101"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={envForm.type}
                    onValueChange={(v) => setEnvForm({ ...envForm, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENV_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    value={envForm.location}
                    onChange={(e) => setEnvForm({ ...envForm, location: e.target.value })}
                    placeholder="Bloco A, 1º andar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={envForm.notes}
                    onChange={(e) => setEnvForm({ ...envForm, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Criar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {environments?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum ambiente cadastrado ainda
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" className="space-y-3">
        {environments?.map((env) => {
          const items = equipment?.filter((e) => e.environment_id === env.id) ?? [];
          return (
            <AccordionItem key={env.id} value={env.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">{env.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ENV_TYPES.find((t) => t.value === env.type)?.label}
                      {env.location ? ` • ${env.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto mr-3">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {env.notes && (
                  <p className="text-sm text-muted-foreground">{env.notes}</p>
                )}
                <div className="space-y-2">
                  {items.map((item) => {
                    const Icon = equipIcon(item.type);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 border rounded-md"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[item.brand, item.model, item.serial_number]
                              .filter(Boolean)
                              .join(" • ") || "—"}
                          </p>
                        </div>
                        <Badge
                          variant={item.status === "ativo" ? "default" : "secondary"}
                        >
                          {item.status}
                        </Badge>
                        {canManage && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteEquip(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum equipamento neste ambiente
                    </p>
                  )}
                </div>

                {canManage && (
                  <div className="flex gap-2 pt-2">
                    <Dialog
                      open={equipOpen === env.id}
                      onOpenChange={(o) => setEquipOpen(o ? env.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4" /> Adicionar equipamento
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Novo equipamento em {env.name}</DialogTitle>
                        </DialogHeader>
                        <form
                          onSubmit={(e) => createEquip(env.id, e)}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Tipo</Label>
                              <Select
                                value={equipForm.type}
                                onValueChange={(v) =>
                                  setEquipForm({ ...equipForm, type: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EQUIP_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select
                                value={equipForm.status}
                                onValueChange={(v) =>
                                  setEquipForm({ ...equipForm, status: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ativo">Ativo</SelectItem>
                                  <SelectItem value="manutencao">Manutenção</SelectItem>
                                  <SelectItem value="inativo">Inativo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Nome / identificação</Label>
                            <Input
                              required
                              value={equipForm.name}
                              onChange={(e) =>
                                setEquipForm({ ...equipForm, name: e.target.value })
                              }
                              placeholder="Ex: PC-Professor-01"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Marca</Label>
                              <Input
                                value={equipForm.brand}
                                onChange={(e) =>
                                  setEquipForm({ ...equipForm, brand: e.target.value })
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Modelo</Label>
                                <Input
                                  value={equipForm.model}
                                  onChange={(e) =>
                                    setEquipForm({ ...equipForm, model: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Nº de série / patrimônio</Label>
                            <Input
                              value={equipForm.serial_number}
                              onChange={(e) =>
                                setEquipForm({
                                  ...equipForm,
                                  serial_number: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                              value={equipForm.notes}
                              onChange={(e) =>
                                setEquipForm({ ...equipForm, notes: e.target.value })
                              }
                            />
                          </div>
                          <Button type="submit" className="w-full">
                            Adicionar
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteEnv(env.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Excluir ambiente
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}