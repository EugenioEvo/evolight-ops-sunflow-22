import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
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
                  <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                      <header className="h-12 flex items-center border-b bg-background px-4">
                        <SidebarTrigger />
                      </header>
                      <main className="flex-1 overflow-auto">
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/tickets" element={<Tickets />} />
                          <Route path="/routes" element={<RoutesPage />} />
                          <Route path="/clientes" element={<Clientes />} />
                          <Route path="/prestadores" element={<Prestadores />} />
                          <Route path="/tecnicos" element={<Tecnicos />} />
                          <Route path="/minhas-os" element={<MinhasOS />} />
                          <Route path="/equipamentos" element={<Equipamentos />} />
                          <Route path="/insumos" element={<Insumos />} />
                          <Route path="/rme" element={<RME />} />
                          <Route path="/relatorios" element={<Relatorios />} />
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