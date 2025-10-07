import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopHeader } from "@/components/TopHeader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import RoutesPage from "./pages/Routes";
import Clientes from "./pages/Clientes";
import Tickets from "./pages/Tickets";
import Equipamentos from "./pages/Equipamentos";
import Insumos from "./pages/Insumos";
import Prestadores from "./pages/Prestadores";
import Tecnicos from "./pages/Tecnicos";
import MinhasOS from "./pages/MinhasOS";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import RME from "./pages/RME";
import Relatorios from "./pages/Relatorios";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
                          <Route path="/tickets" element={<Tickets />} />
                          <Route path="/routes" element={<RoutesPage />} />
                          <Route path="/clientes" element={
                            <ProtectedRoute roles={['admin', 'area_tecnica']}>
                              <Clientes />
                            </ProtectedRoute>
                          } />
                          <Route path="/prestadores" element={
                            <ProtectedRoute roles={['admin', 'area_tecnica']}>
                              <Prestadores />
                            </ProtectedRoute>
                          } />
                          <Route path="/tecnicos" element={
                            <ProtectedRoute roles={['admin', 'area_tecnica']}>
                              <Tecnicos />
                            </ProtectedRoute>
                          } />
                          <Route path="/minhas-os" element={<MinhasOS />} />
                          <Route path="/equipamentos" element={
                            <ProtectedRoute roles={['admin', 'area_tecnica']}>
                              <Equipamentos />
                            </ProtectedRoute>
                          } />
                          <Route path="/insumos" element={
                            <ProtectedRoute roles={['admin', 'area_tecnica']}>
                              <Insumos />
                            </ProtectedRoute>
                          } />
                          <Route path="/rme" element={<RME />} />
                          <Route path="/relatorios" element={
                            <ProtectedRoute roles={['admin', 'area_tecnica']}>
                              <Relatorios />
                            </ProtectedRoute>
                          } />
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;