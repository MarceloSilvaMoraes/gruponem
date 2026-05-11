import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { Camera, Package, MessageSquareText } from "lucide-react";
import Index from "./pages/Index.tsx";
import Chamados from "./pages/Chamados.tsx";
import TicketDetail from "./pages/TicketDetail.tsx";
import Auth from "./pages/Auth.tsx";
import TeamManagement from "./pages/TeamManagement.tsx";
import Metrics from "./pages/Metrics.tsx";
import Triggers from "./pages/Triggers.tsx";
import Computadores from "./pages/Computadores.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";
import Contatos from "./pages/Contatos.tsx";
import MeusChamados, { MeuChamadoDetalhe } from "./pages/MeusChamados.tsx";
import Ambientes from "./pages/Ambientes.tsx";
import Relatorios from "./pages/Relatorios.tsx";
import Orcamentos from "./pages/Orcamentos.tsx";
import Agenda from "./pages/Agenda.tsx";
import Inventory from "./pages/Inventory.tsx";
import SetupDB from "./pages/SetupDB.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup-db" element={<SetupDB />} />
              <Route
                path="/meus-chamados"
                element={
                  <ProtectedRoute endUserOnly>
                    <MeusChamados />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meus-chamados/:id"
                element={
                  <ProtectedRoute endUserOnly>
                    <MeuChamadoDetalhe />
                  </ProtectedRoute>
                }
              />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/chamados" element={<Chamados />} />
                <Route path="/ticket/:id" element={<TicketDetail />} />
                <Route path="/computadores" element={<Computadores />} />
                <Route path="/ambientes" element={<Ambientes />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/orcamentos" element={<Orcamentos />} />
                <Route
                  path="/cameras"
                  element={
                    <PlaceholderPage
                      title="Câmeras"
                      description="Monitoramento de câmeras e CFTV"
                      icon={Camera}
                    />
                  }
                />
                <Route
                  path="/estoque"
                  element={<Inventory />}
                />
                <Route
                  path="/chat-ia"
                  element={
                    <PlaceholderPage
                      title="Chat IA"
                      description="Assistente inteligente para suporte"
                      icon={MessageSquareText}
                    />
                  }
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute adminOnly>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/team" element={<TeamManagement />} />
                <Route path="/contatos" element={<Contatos />} />
                <Route path="/metrics" element={<Metrics />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/triggers" element={<Triggers />} />
                <Route path="/configuracoes" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
