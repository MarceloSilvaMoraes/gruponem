import {
  LayoutDashboard,
  Inbox,
  Monitor,
  MapPin,
  Camera,
  Package,
  FileText,
  Users,
  Contact,
  MessageSquareText,
  BarChart3,
  CalendarDays,
  Webhook,
  Headphones,
  Settings as SettingsIcon,
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
import { useAppName } from "@/hooks/useAppName";
import { useMenuVisibility, isItemVisible } from "@/hooks/useMenuVisibility";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Chamados", url: "/chamados", icon: Inbox },
  { title: "Computadores", url: "/computadores", icon: Monitor },
  { title: "Ambientes", url: "/ambientes", icon: MapPin },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Câmeras", url: "/cameras", icon: Camera },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
];

const adminItems = [
  { title: "Equipe", url: "/team", icon: Users },
  { title: "Contatos", url: "/contatos", icon: Contact },
  { title: "Métricas", url: "/metrics", icon: BarChart3 },
  { title: "Relatórios", url: "/relatorios", icon: CalendarDays },
  { title: "Gatilhos", url: "/triggers", icon: Webhook },
  { title: "Configurações", url: "/configuracoes", icon: SettingsIcon },
];

const aiItems = [{ title: "Chat IA", url: "/chat-ia", icon: MessageSquareText }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useAuth();
  const { data: appName } = useAppName();
  const { data: visibility } = useMenuVisibility();

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
            <div className="leading-tight min-w-0">
              <p className="font-display font-bold text-base truncate">{appName || "Suporte"}</p>
              <p className="text-[10px] text-muted-foreground">Suporte de TI</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.filter((i) => isItemVisible(visibility, i.url)).map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.filter((i) => isItemVisible(visibility, i.url)).map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiItems.filter((i) => isItemVisible(visibility, i.url)).map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}