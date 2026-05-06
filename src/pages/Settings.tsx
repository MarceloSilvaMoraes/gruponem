import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppName, useUpdateAppName } from "@/hooks/useAppName";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  useMenuVisibility,
  useUpdateMenuVisibility,
  isItemVisible,
} from "@/hooks/useMenuVisibility";
import { toast } from "sonner";

const ALL_MENU_ITEMS = [
  { group: "Principal", url: "/", label: "Dashboard" },
  { group: "Principal", url: "/chamados", label: "Chamados" },
  { group: "Principal", url: "/computadores", label: "Computadores" },
  { group: "Principal", url: "/ambientes", label: "Ambientes" },
  { group: "Principal", url: "/cameras", label: "Câmeras" },
  { group: "Principal", url: "/estoque", label: "Estoque" },
  { group: "Principal", url: "/orcamentos", label: "Orçamentos" },
  { group: "Admin", url: "/team", label: "Equipe" },
  { group: "Admin", url: "/contatos", label: "Contatos" },
  { group: "Admin", url: "/metrics", label: "Métricas" },
  { group: "Admin", url: "/relatorios", label: "Relatórios" },
  { group: "Admin", url: "/triggers", label: "Gatilhos" },
  { group: "IA", url: "/chat-ia", label: "Chat IA" },
];

export default function Settings() {
  const { data: appName, isLoading } = useAppName();
  const update = useUpdateAppName();
  const [name, setName] = useState("");
  const { role } = useAuth();
  const { data: visibility } = useMenuVisibility();
  const updateVisibility = useUpdateMenuVisibility();

  useEffect(() => {
    if (appName) setName(appName);
  }, [appName]);

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("O nome não pode estar vazio");
      return;
    }
    try {
      await update.mutateAsync(name.trim());
      toast.success("Nome do sistema atualizado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalize as informações gerais do sistema
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Identidade</h2>
          <p className="text-sm text-muted-foreground">
            Esse nome aparece na barra lateral e nos títulos do sistema.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-name">Nome do sistema</Label>
          <Input
            id="app-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Suporte NEM"
            disabled={isLoading}
            maxLength={40}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={update.isPending || isLoading}>
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {role === "admin" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Visibilidade do menu</h2>
            <p className="text-sm text-muted-foreground">
              Mostre ou oculte funcionalidades na barra lateral para todos os usuários.
            </p>
          </div>
          {["Principal", "Admin", "IA"].map((group) => (
            <div key={group} className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{group}</p>
              {ALL_MENU_ITEMS.filter((i) => i.group === group).map((item) => {
                const visible = isItemVisible(visibility, item.url);
                return (
                  <div
                    key={item.url}
                    className="flex items-center justify-between border rounded-md px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.url}</p>
                    </div>
                    <Switch
                      checked={visible}
                      onCheckedChange={async (checked) => {
                        const next = { ...(visibility ?? {}), [item.url]: checked };
                        try {
                          await updateVisibility.mutateAsync(next);
                          toast.success("Menu atualizado");
                        } catch (e: any) {
                          toast.error(e.message || "Erro ao salvar");
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}