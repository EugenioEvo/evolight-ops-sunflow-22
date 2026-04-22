import { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Zap, 
  Package, 
  Route, 
  BarChart3, 
  Home,
  LogOut,
  User,
  ClipboardList,
  Calendar,
  CheckSquare,
  TrendingUp,
  Monitor,
  ShieldAlert,
  PackageCheck,
  Boxes
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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

type Role = 'admin' | 'engenharia' | 'supervisao' | 'backoffice' | 'tecnico_campo' | 'cliente';

interface NavItem {
  title: string;
  url: string;
  icon: any;
  /** roles permitidas; se omitido, todas as autenticadas */
  allow?: Role[];
}

const STAFF: Role[] = ['admin', 'engenharia', 'supervisao'];
const STAFF_BO: Role[] = [...STAFF, 'backoffice'];

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: Home, allow: [...STAFF_BO, 'tecnico_campo', 'cliente'] },
  { title: "Meu Painel", url: "/meu-painel", icon: User, allow: ['cliente'] },
  { title: "Tickets", url: "/tickets", icon: Package, allow: STAFF_BO },
  { title: "Ordens de Serviço", url: "/work-orders", icon: ClipboardList, allow: STAFF_BO },
  { title: "RME", url: "/rme", icon: BarChart3, allow: STAFF_BO },
  { title: "Rotas", url: "/routes", icon: Route, allow: [...STAFF_BO, 'tecnico_campo'] },
  { title: "Agenda", url: "/agenda", icon: Calendar, allow: STAFF_BO },
  { title: "Carga de Trabalho", url: "/carga-trabalho", icon: TrendingUp, allow: STAFF },
  { title: "Confirmações", url: "/dashboard-presenca", icon: Monitor, allow: STAFF },
  { title: "Aprovar RMEs", url: "/gerenciar-rme", icon: CheckSquare, allow: STAFF },
  { title: "Validar Insumos", url: "/backoffice/insumos", icon: PackageCheck, allow: [...STAFF, 'backoffice'] },
];

const cadastroItems: NavItem[] = [
  { title: "Clientes", url: "/clientes", icon: Building2, allow: STAFF_BO },
  { title: "Prestadores", url: "/prestadores", icon: Users, allow: STAFF_BO },
  { title: "Usuários", url: "/usuarios", icon: User, allow: ['admin', 'engenharia'] },
  { title: "Equipamentos", url: "/equipamentos", icon: Zap, allow: STAFF_BO },
  { title: "Insumos", url: "/insumos", icon: Package, allow: [...STAFF_BO, 'tecnico_campo'] },
  { title: "Kits", url: "/kits", icon: Boxes, allow: ['admin', 'backoffice'] },
];

const systemItems: NavItem[] = [
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, allow: STAFF_BO },
  { title: "Auditoria", url: "/audit-logs", icon: ShieldAlert, allow: ['admin'] },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = !open;
  const [pendingRMEsCount, setPendingRMEsCount] = useState(0);
  const [pendingInsumosCount, setPendingInsumosCount] = useState(0);

  const userRoles = (profile?.roles ?? []) as Role[];
  const hasAnyRole = (allow?: Role[]) => !allow || allow.some(r => userRoles.includes(r));

  const isTecnico = userRoles.includes('tecnico_campo');
  const isStaff = userRoles.some(r => STAFF.includes(r));
  const isBackoffice = userRoles.includes('backoffice');
  const showCadastros = isStaff || isBackoffice || isTecnico;

  useEffect(() => {
    if (isStaff) {
      loadPendingRMEsCount();
      const channel = supabase
        .channel('rme-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rme_relatorios' }, loadPendingRMEsCount)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isStaff]);

  useEffect(() => {
    if (isStaff || isBackoffice) {
      loadPendingInsumosCount();
      const channel = supabase
        .channel('insumo-saidas-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'insumo_saidas' }, loadPendingInsumosCount)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'insumo_devolucoes' }, loadPendingInsumosCount)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isStaff, isBackoffice]);

  const loadPendingRMEsCount = async () => {
    const { count } = await supabase.from('rme_relatorios').select('*', { count: 'exact', head: true }).eq('status', 'pendente');
    setPendingRMEsCount(count || 0);
  };

  const loadPendingInsumosCount = async () => {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from('insumo_saidas').select('*', { count: 'exact', head: true }).eq('status', 'pendente_aprovacao'),
      supabase.from('insumo_devolucoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente_aprovacao'),
    ]);
    setPendingInsumosCount((c1 || 0) + (c2 || 0));
  };

  const isActive = (path: string) => currentPath === path;
  const getNavClass = (path: string) =>
    isActive(path)
      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  const renderItem = (item: NavItem, badgeCount?: number) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink to={item.url} className={getNavClass(item.url)}>
          <item.icon className="h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
          {!collapsed && badgeCount && badgeCount > 0 && (
            <Badge variant="destructive" className="ml-auto">{badgeCount}</Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

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
              {mainItems.filter(i => hasAnyRole(i.allow)).flatMap(item => {
                const out: JSX.Element[] = [];
                const badge =
                  item.title === "Aprovar RMEs" ? pendingRMEsCount :
                  item.title === "Validar Insumos" ? pendingInsumosCount :
                  undefined;
                out.push(renderItem(item, badge));
                if (isTecnico && item.url === "/") {
                  out.push(
                    <SidebarMenuItem key="minhas-os">
                      <SidebarMenuButton asChild>
                        <NavLink to="/minhas-os" className={getNavClass("/minhas-os")}>
                          <ClipboardList className="h-4 w-4" />
                          {!collapsed && <span>Minhas OS</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                return out;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showCadastros && (
          <SidebarGroup>
            <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {cadastroItems.filter(i => hasAnyRole(i.allow)).map(item => renderItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.filter(i => hasAnyRole(i.allow)).map(item => renderItem(item))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
