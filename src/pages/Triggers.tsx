import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Copy, Plus, Webhook } from "lucide-react";
import { toast } from "sonner";

type Trigger = {
  id: string;
  keyword: string;
  description: string | null;
  typebot_url: string | null;
  active: boolean;
  created_at: string;
};

export default function Triggers() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [description, setDescription] = useState("");
  const [typebotUrl, setTypebotUrl] = useState("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const endpoint = `https://${projectId}.supabase.co/functions/v1/typebot-webhook`;

  const { data: triggers, isLoading } = useQuery({
    queryKey: ["triggers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trigger_keywords")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Trigger[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trigger_keywords").insert({
        keyword: keyword.trim().toLowerCase(),
        description: description.trim() || null,
        typebot_url: typebotUrl.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gatilho criado");
      setKeyword("");
      setDescription("");
      setTypebotUrl("");
      qc.invalidateQueries({ queryKey: ["triggers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("trigger_keywords")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trigger_keywords").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gatilho removido");
      qc.invalidateQueries({ queryKey: ["triggers"] });
    },
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const sample = JSON.stringify(
    {
      phone: "5511999999999",
      name: "João da Silva",
      keyword: "suporte01",
      subject: "Sem acesso ao ERP",
      description: "Não consigo entrar no sistema desde hoje cedo...",
      category: "suporte",
      priority: "high",
    },
    null,
    2
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gatilhos do Typebot</h1>
        <p className="text-muted-foreground text-sm">
          Palavras enviadas no WhatsApp que disparam o fluxo do Typebot. A IA não responde quando a mensagem for um gatilho.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Endpoint para o Typebot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure um bloco <strong>HTTP Request (POST)</strong> no final do seu fluxo Typebot apontando para:
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-muted p-2 rounded text-xs break-all">{endpoint}</code>
            <Button size="sm" variant="outline" onClick={() => copy(endpoint)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div>
            <Label className="text-xs">Body (JSON) de exemplo</Label>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-1">{sample}</pre>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(sample)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar JSON
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Campos obrigatórios: <code>phone</code> e <code>description</code>. Use as variáveis do Typebot
            (ex: <code>{"{{phone}}"}</code>, <code>{"{{descricao}}"}</code>).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo gatilho</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!keyword.trim()) return;
              createMut.mutate();
            }}
            className="grid md:grid-cols-4 gap-3 items-end"
          >
            <div className="md:col-span-1">
              <Label className="text-xs">Palavra-chave</Label>
              <Input
                placeholder="suporte01"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                placeholder="O que esse gatilho atende"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Label className="text-xs">URL Typebot (opcional)</Label>
              <Input
                placeholder="https://typebot.../bot/suporte01"
                value={typebotUrl}
                onChange={(e) => setTypebotUrl(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={createMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gatilhos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !triggers?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum gatilho cadastrado.</p>
          ) : (
            <div className="divide-y">
              {triggers.map((t) => (
                <div key={t.id} className="py-3 flex items-center gap-3">
                  <Badge variant={t.active ? "default" : "secondary"} className="font-mono">
                    {t.keyword}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{t.description ?? "—"}</p>
                    {t.typebot_url && (
                      <p className="text-xs text-muted-foreground truncate">{t.typebot_url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={t.active}
                      onCheckedChange={(active) => toggleMut.mutate({ id: t.id, active })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remover gatilho "${t.keyword}"?`)) deleteMut.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}