import { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Zap, 
  Package, 
  Route, 
  BarChart3, 
  Settings,
  Home,
  FileText,
  LogOut,
  User,
  ClipboardList,
  Calendar,
  CheckSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Tickets", url: "/tickets", icon: Package },
  { title: "RME", url: "/rme", icon: BarChart3 },
  { title: "Rotas", url: "/routes", icon: Route },
  { title: "Agenda", url: "/agenda", icon: Calendar, adminOnly: true },
  { title: "Aprovar RMEs", url: "/gerenciar-rme", icon: CheckSquare, adminOnly: true },
];

const cadastroItems = [
  { title: "Clientes", url: "/clientes", icon: Building2 },
  { title: "Prestadores", url: "/prestadores", icon: Users },
  { title: "Equipamentos", url: "/equipamentos", icon: Zap },
  { title: "Insumos", url: "/insumos", icon: Package },
];

const systemItems = [
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { open, isMobile } = useSidebar();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = !open;
  const [pendingRMEsCount, setPendingRMEsCount] = useState(0);

  const isTecnico = profile?.role === "tecnico_campo";
  const isAdminOrAreaTecnica = profile?.role === "admin" || profile?.role === "area_tecnica";

  useEffect(() => {
    if (isAdminOrAreaTecnica) {
      loadPendingRMEsCount();
      
      const channel = supabase
        .channel('rme-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'rme_relatorios',
          filter: 'status_aprovacao=eq.pendente'
        }, loadPendingRMEsCount)
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    }
  }, [isAdminOrAreaTecnica]);

  const loadPendingRMEsCount = async () => {
    const { count } = await supabase
      .from('rme_relatorios')
      .select('*', { count: 'exact', head: true })
      .eq('status_aprovacao', 'pendente');
    
    setPendingRMEsCount(count || 0);
  };

  const isActive = (path: string) => currentPath === path;
  const getNavClass = (path: string) =>
    isActive(path) 
      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-card border-r">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="relative p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Zap className="h-6 w-6 text-white" />
              <div className="absolute inset-0 bg-amber-400/20 rounded-lg blur"></div>
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                  SunFlow
                </h2>
                <p className="text-xs text-muted-foreground">Solar O&M</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter(item => !item.adminOnly || isAdminOrAreaTecnica)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass(item.url)}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                        {item.title === "Aprovar RMEs" && pendingRMEsCount > 0 && !collapsed && (
                          <Badge variant="destructive" className="ml-auto">
                            {pendingRMEsCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              {isTecnico && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/minhas-os" className={getNavClass("/minhas-os")}>
                      <ClipboardList className="h-4 w-4" />
                      {!collapsed && <span>Minhas OS</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdminOrAreaTecnica && (
          <SidebarGroup>
            <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {cadastroItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass(item.url)}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems
                .filter(item => {
                  // Filtrar Relatórios para técnicos
                  if (item.title === "Relatórios" && !isAdminOrAreaTecnica) {
                    return false;
                  }
                  return true;
                })
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass(item.url)}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              
              {/* Logout Button */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer com informações do usuário */}
        {profile && !collapsed && (
          <div className="mt-auto p-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{profile.nome}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {profile.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}