import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { toast } from "sonner";

type Contact = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  sector: string | null;
  role_title: string | null;
  user_id: string | null;
};

const empty = { name: "", phone: "", email: "", sector: "", role_title: "" };

export default function Contatos() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [submitting, setSubmitting] = useState(false);

  const { data: contacts, refetch } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, email, sector, role_title, user_id")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const filtered = contacts?.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.sector ?? "").toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      sector: c.sector ?? "",
      role_title: c.role_title ?? "",
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name.trim() || null,
      phone: form.phone.replace(/\D/g, ""),
      email: form.email.trim() || null,
      sector: form.sector.trim() || null,
      role_title: form.role_title.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("contacts").update(payload).eq("id", editing.id)
      : await supabase.from("contacts").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success(editing ? "Contato atualizado" : "Contato criado");
      setOpen(false);
      refetch();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir", { description: error.message });
    else {
      toast.success("Contato excluído");
      refetch();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="h-6 w-6" /> Contatos / Usuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre usuários finais com setor, cargo e e-mail. Quando criarem conta com o mesmo e-mail, terão acesso aos próprios chamados.
          </p>
        </div>
        <Button onClick={openNew}>
          <UserPlus className="h-4 w-4" /> Novo contato
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Cadastrados ({contacts?.length ?? 0})</CardTitle>
          <Input
            className="max-w-xs"
            placeholder="Buscar por nome, telefone, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{c.name || "Sem nome"}</p>
                  {c.user_id && (
                    <Badge variant="secondary" className="text-[10px]">
                      Acesso ao portal
                    </Badge>
                  )}
                  {c.sector && (
                    <Badge className="text-[10px] bg-primary/15 text-primary hover:bg-primary/15">
                      {c.sector}
                    </Badge>
                  )}
                  {c.role_title && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.role_title}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.phone}
                  {c.email && <> • {c.email}</>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Os chamados existentes serão mantidos, mas perderão o vínculo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(c.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {filtered?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum contato encontrado
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Maria Silva"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone (DDI+DDD+Número)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="55XX9XXXXXXXX"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail (necessário para acesso ao portal)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Input
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  placeholder="RH, Financeiro..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  value={form.role_title}
                  onChange={(e) => setForm({ ...form, role_title: e.target.value })}
                  placeholder="Analista, Gerente..."
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Salvando..." : editing ? "Salvar alterações" : "Criar contato"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}