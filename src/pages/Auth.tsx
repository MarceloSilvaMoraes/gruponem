import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    // Check if any admin already exists — if not, allow first signup
    supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .then(({ count }) => setAdminExists((count ?? 0) > 0));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // If an admin already exists, only allow signup when the e-mail matches a registered contact
    if (adminExists) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (!contact) {
        setSubmitting(false);
        toast.error("E-mail não cadastrado", {
          description:
            "Peça ao administrador para cadastrar seu e-mail em Contatos antes de criar sua conta.",
        });
        return;
      }
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Falha no cadastro", { description: error.message });
    } else {
      toast.success("Conta criada", {
        description: adminExists
          ? "Faça login para acessar seus chamados."
          : "Você foi promovido a Administrador. Faça login para continuar.",
      });
      setAdminExists(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Entrar no Suporte T.I.</CardTitle>
          <p className="text-sm text-muted-foreground">
            Acesse com seu e-mail corporativo
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={adminExists === false ? "signup" : "login"}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">
                {adminExists === false ? "Criar admin" : "Acompanhar meus chamados"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Entrando..." : "Entrar"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Apenas administradores cadastram novas contas pela tela de Equipe.
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                {adminExists ? (
                  <p className="text-xs text-muted-foreground">
                    Crie sua conta para acompanhar seus chamados pelo portal. Use o mesmo
                    e-mail que o administrador cadastrou em Contatos.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Esta é a primeira conta — você será promovido a Administrador automaticamente.
                  </p>
                )}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-s">E-mail</Label>
                    <Input id="email-s" type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-s">Senha (mín. 6)</Label>
                    <Input id="password-s" type="password" value={password}
                      onChange={(e) => setPassword(e.target.value)} required minLength={6}
                      autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting
                      ? "Criando..."
                      : adminExists
                        ? "Criar minha conta"
                        : "Criar conta de admin"}
                  </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}