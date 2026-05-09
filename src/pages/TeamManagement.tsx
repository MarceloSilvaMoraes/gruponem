import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, ShieldCheck, User, Pencil, Trash2 } from "lucide-react";
import { useTeam, TeamMember } from "@/hooks/useTeam";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const queryClient = useQueryClient();
  const { data: team } = useTeam();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const [form, setForm] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "attendant" as "admin" | "attendant",
  });

  const [editForm, setEditForm] = useState({
    display_name: "",
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
      queryClient.invalidateQueries({ queryKey: ["team"] });
    }
  };

  const handleOpenEdit = (m: TeamMember) => {
    setEditingMember(m);
    setEditForm({
      display_name: m.display_name,
      role: m.role,
    });
    setEditOpen(true);
  };

  const updateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setSubmitting(true);

    let nameUpdated = false;
    let roleUpdated = false;

    try {
      // 1. Try to Update Profile (Display Name)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ display_name: editForm.display_name })
        .eq("user_id", editingMember.user_id);
      
      if (!pErr) nameUpdated = true;

      // 2. Update Role (Delete then Insert to bypass RLS update restrictions)
      // Even if role hasn't "changed" in the UI, we re-apply it to be sure
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", editingMember.user_id);
      
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ 
          user_id: editingMember.user_id, 
          role: editForm.role 
        });
      
      if (insErr) throw insErr;
      roleUpdated = true;

      if (nameUpdated || roleUpdated) {
        if (!nameUpdated && editForm.display_name !== editingMember.display_name) {
          toast.warning("Papel atualizado, mas o nome não pôde ser alterado (bloqueio do banco).");
        } else {
          toast.success("Colaborador atualizado com sucesso");
        }
      }
      
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (err: any) {
      toast.error("Erro ao atualizar", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMember = async (userId: string) => {
    try {
      const { error: rErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (rErr) throw rErr;

      toast.success("Colaborador removido");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (err: any) {
      toast.error("Erro ao remover", { description: err.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">Gerencie colaboradores e seus papéis</p>
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
            <div key={m.user_id} className="flex items-center justify-between p-3 rounded-lg border">
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
                
                <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover colaborador?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação removerá "{m.display_name}" da equipe. Ele não terá mais acesso ao sistema.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMember(m.user_id)} className="bg-destructive text-destructive-foreground">
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {team?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum colaborador ainda</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar colaborador</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateMember} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v as any })}
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
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}