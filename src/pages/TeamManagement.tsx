import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, ShieldCheck, User } from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

export default function TeamManagement() {
  const navigate = useNavigate();
  const { data: team, refetch } = useTeam();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "attendant" as "admin" | "attendant",
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("admin-create-user", { body: form });
    setSubmitting(false);
    if (error) {
      toast.error("Falha ao criar usuário", { description: error.message });
    } else {
      toast.success("Colaborador criado");
      setOpen(false);
      setForm({ display_name: "", email: "", password: "", role: "attendant" });
      refetch();
    }
  };

  const toggleRole = async (userId: string, current: "admin" | "attendant") => {
    const next = current === "admin" ? "attendant" : "admin";
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: next });
    if (error) toast.error("Erro ao mudar papel", { description: error.message });
    else {
      toast.success(`Agora é ${next === "admin" ? "Administrador" : "Atendente"}`);
      refetch();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Equipe</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie colaboradores e seus papéis
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4" /> Novo colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar colaborador</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome de exibição</Label>
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha temporária (mín. 6)</Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attendant">Atendente</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Colaboradores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {team?.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {m.role === "admin" ? (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{m.display_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                    {m.role === "admin" ? "Admin" : "Atendente"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => toggleRole(m.user_id, m.role)}>
                    {m.role === "admin" ? "→ Atendente" : "→ Admin"}
                  </Button>
                </div>
              </div>
            ))}
            {team?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum colaborador ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}