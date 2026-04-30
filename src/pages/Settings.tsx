import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppName, useUpdateAppName } from "@/hooks/useAppName";
import { toast } from "sonner";

export default function Settings() {
  const { data: appName, isLoading } = useAppName();
  const update = useUpdateAppName();
  const [name, setName] = useState("");

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
    <div className="p-6 md:p-8 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalize as informações gerais do sistema
        </p>
      </div>

      <div className="mt-8 rounded-xl border bg-card p-6 space-y-4">
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
    </div>
  );
}