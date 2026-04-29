import { Outlet } from "react-router-dom";
import { LogOut, Bell, Moon, Sun } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export function AppLayout() {
  const { user, role, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b bg-card px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <Badge
                variant={role === "admin" ? "default" : "secondary"}
                className="text-[10px] hidden sm:inline-flex"
              >
                {role === "admin" ? "Admin" : "Atendente"}
              </Badge>
              <span className="text-xs text-muted-foreground hidden md:inline">
                {user?.email}
              </span>
              <Button variant="ghost" size="icon" onClick={toggle} title="Alternar tema">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" title="Notificações">
                <Bell className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await signOut();
                  navigate("/auth", { replace: true });
                }}
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}