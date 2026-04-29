import {
  LayoutDashboard,
  Inbox,
  Monitor,
  Camera,
  Package,
  FileText,
  Users,
  MessageSquareText,
  BarChart3,
  Webhook,
  Headphones,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Chamados", url: "/chamados", icon: Inbox },
  { title: "Computadores", url: "/computadores", icon: Monitor },
  { title: "Câmeras", url: "/cameras", icon: Camera },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
];

const adminItems = [
  { title: "Equipe", url: "/team", icon: Users },
  { title: "Métricas", url: "/metrics", icon: BarChart3 },
  { title: "Gatilhos", url: "/triggers", icon: Webhook },
];

const aiItems = [{ title: "Chat IA", url: "/chat-ia", icon: MessageSquareText }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useAuth();

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);

  const renderItem = (item: { title: string; url: string; icon: any }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item.url)}>
        <NavLink to={item.url} end={item.url === "/"}>
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Headphones className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-display font-bold text-base">TechDesk Pro</p>
              <p className="text-[10px] text-muted-foreground">Suporte de TI</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{adminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{aiItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}