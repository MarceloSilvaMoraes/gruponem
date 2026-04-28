import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Users, BarChart3, Inbox, Webhook } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const linkCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
    }`;

  return (
    <header className="border-b bg-card sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-bold text-lg">
          🎫 Suporte T.I.
        </Link>
        <nav className="flex items-center gap-1 ml-4">
          <Link to="/" className={linkCls(pathname === "/")}>
            <Inbox className="h-4 w-4" /> Chamados
          </Link>
          {role === "admin" && (
            <>
              <Link to="/metrics" className={linkCls(pathname === "/metrics")}>
                <BarChart3 className="h-4 w-4" /> Métricas
              </Link>
              <Link to="/team" className={linkCls(pathname === "/team")}>
                <Users className="h-4 w-4" /> Equipe
              </Link>
              <Link to="/triggers" className={linkCls(pathname === "/triggers")}>
                <Webhook className="h-4 w-4" /> Gatilhos
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <Badge variant={role === "admin" ? "default" : "secondary"} className="text-[10px]">
              {role === "admin" ? "Administrador" : "Atendente"}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}