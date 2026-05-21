import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopHeader } from "@/components/TopHeader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RealtimeProvider } from "@/hooks/useRealtimeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import RoutesPage from "./pages/Routes";
import Agenda from "./pages/Agenda";
import CargaTrabalho from "./pages/CargaTrabalho";
import Clientes from "./pages/Clientes";
import Tickets from "./pages/Tickets";
import Equipamentos from "./pages/Equipamentos";
import Insumos from "./pages/Insumos";
import Prestadores from "./pages/Prestadores";
import Tecnicos from "./pages/Tecnicos";
import MinhasOS from "./pages/MinhasOS";
import MinhasDevolucoes from "./pages/MinhasDevolucoes";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { Navigate, useSearchParams } from "react-router-dom";
import Relatorios from "./pages/Relatorios";
import GerenciarRME from "./pages/GerenciarRME";
import DashboardPresenca from "./pages/DashboardPresenca";
import AuditLogs from "./pages/AuditLogs";
import ClientDashboard from "./pages/ClientDashboard";
import PresenceConfirmation from "./pages/PresenceConfirmation";
import VisualizarOS from "./pages/VisualizarOS";
import WorkOrders from "./pages/WorkOrders";
// WorkOrderCreate removed (Phase 3) — replaced by MultiTechnicianOSDialog (standalone mode) opened from /work-orders.
import WorkOrderDetail from "./pages/WorkOrderDetail";
import RMEWizard from "./pages/RMEWizard";
import ResetPassword from "./pages/ResetPassword";
import Candidatar from "./pages/Candidatar";
import Usuarios from "./pages/Usuarios";
import Kits from "./pages/Kits";
import BackofficeInsumos from "./pages/BackofficeInsumos";
import Obras from "./pages/Obras";
import ObraDetail from "./pages/ObraDetail";
import ObraCatalogo from "./pages/ObraCatalogo";
import RDO from "./pages/RDO";
import RDOWizard from "./pages/RDOWizard";
import GerenciarRDO from "./pages/GerenciarRDO";
import DashboardRDO from "./pages/DashboardRDO";

// Legacy /rme route → redirects to the unified Wizard, preserving ?os=
const LegacyRMERedirect = () => {
  const [params] = useSearchParams();
  const os = params.get("os");
  return <Navigate to={os ? `/rme-wizard/new?os=${os}` : "/minhas-os"} replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/candidatar-se" element={<Candidatar />} />
              <Route path="/confirmar-presenca" element={<PresenceConfirmation />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-background">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <TopHeader />
                        <main className="flex-1 overflow-auto bg-muted/30">
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/meu-painel" element={
                              <ProtectedRoute roles={['cliente']}>
                                <ClientDashboard />
                              </ProtectedRoute>
                            } />
                            <Route path="/tickets" element={<Tickets />} />
                            <Route path="/routes" element={<RoutesPage />} />
                            <Route path="/agenda" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <Agenda />
                              </ProtectedRoute>
                            } />
                            <Route path="/carga-trabalho" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <CargaTrabalho />
                              </ProtectedRoute>
                            } />
                            <Route path="/dashboard-presenca" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <DashboardPresenca />
                              </ProtectedRoute>
                            } />
                            <Route path="/clientes" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <Clientes />
                              </ProtectedRoute>
                            } />
                            <Route path="/prestadores" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <Prestadores />
                              </ProtectedRoute>
                            } />
                            <Route path="/usuarios" element={
                              <ProtectedRoute roles={['admin', 'engenharia']}>
                                <Usuarios />
                              </ProtectedRoute>
                            } />
                            <Route path="/tecnicos" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <Tecnicos />
                              </ProtectedRoute>
                            } />
                            <Route path="/minhas-os" element={<MinhasOS />} />
                            <Route path="/minhas-devolucoes" element={
                              <ProtectedRoute roles={['tecnico_campo', 'admin', 'engenharia', 'supervisao', 'backoffice']}>
                                <MinhasDevolucoes />
                              </ProtectedRoute>
                            } />
                            <Route path="/equipamentos" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <Equipamentos />
                              </ProtectedRoute>
                            } />
                            <Route path="/insumos" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'backoffice', 'tecnico_campo']}>
                                <Insumos />
                              </ProtectedRoute>
                            } />
                            <Route path="/kits" element={
                              <ProtectedRoute roles={['admin', 'backoffice']}>
                                <Kits />
                              </ProtectedRoute>
                            } />
                            <Route path="/backoffice/insumos" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'backoffice']}>
                                <BackofficeInsumos />
                              </ProtectedRoute>
                            } />
                            <Route path="/rme" element={<LegacyRMERedirect />} />
                            <Route path="/gerenciar-rme" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <GerenciarRME />
                              </ProtectedRoute>
                            } />
                            <Route path="/obras" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'sup_eletromecanico']}>
                                <Obras />
                              </ProtectedRoute>
                            } />
                            <Route path="/obras/:id" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'sup_eletromecanico']}>
                                <ObraDetail mode="staff" />
                              </ProtectedRoute>
                            } />
                            <Route path="/obra-catalogo" element={
                              <ProtectedRoute roles={['admin']}>
                                <ObraCatalogo />
                              </ProtectedRoute>
                            } />
                            <Route path="/rdo" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'sup_eletromecanico', 'eletromecanico']}>
                                <RDO />
                              </ProtectedRoute>
                            } />
                            <Route path="/rdo/dashboard" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'sup_eletromecanico', 'eletromecanico']}>
                                <DashboardRDO />
                              </ProtectedRoute>
                            } />
                            <Route path="/rdo/novo" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'sup_eletromecanico']}>
                                <RDOWizard />
                              </ProtectedRoute>
                            } />
                            <Route path="/rdo/:id" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao', 'sup_eletromecanico', 'eletromecanico']}>
                                <RDOWizard />
                              </ProtectedRoute>
                            } />
                            <Route path="/gerenciar-rdo" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <GerenciarRDO />
                              </ProtectedRoute>
                            } />
                            <Route path="/portal/obras/:id" element={
                              <ProtectedRoute roles={['cliente']}>
                                <ObraDetail mode="cliente" />
                              </ProtectedRoute>
                            } />
                            <Route path="/relatorios" element={
                              <ProtectedRoute roles={['admin', 'engenharia', 'supervisao']}>
                                <Relatorios />
                              </ProtectedRoute>
                            } />
                            <Route path="/audit-logs" element={
                              <ProtectedRoute roles={['admin']}>
                                <AuditLogs />
                              </ProtectedRoute>
                            } />
                            <Route path="/visualizar-os/:id" element={<VisualizarOS />} />
                            <Route path="/work-orders" element={<WorkOrders />} />
                            <Route path="/work-orders/new" element={<Navigate to="/work-orders" replace />} />
                            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                            <Route path="/rme-wizard/:id" element={<RMEWizard />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;