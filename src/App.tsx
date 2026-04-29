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
import { Monitor, Camera, Package, FileText, MessageSquareText } from "lucide-react";
import Index from "./pages/Index.tsx";
import Chamados from "./pages/Chamados.tsx";
import TicketDetail from "./pages/TicketDetail.tsx";
import Auth from "./pages/Auth.tsx";
import TeamManagement from "./pages/TeamManagement.tsx";
import Metrics from "./pages/Metrics.tsx";
import Triggers from "./pages/Triggers.tsx";
import NotFound from "./pages/NotFound.tsx";

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
                <Route
                  path="/computadores"
                  element={
                    <PlaceholderPage
                      title="Computadores"
                      description="Inventário e status dos equipamentos da rede"
                      icon={Monitor}
                    />
                  }
                />
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
                  element={
                    <PlaceholderPage
                      title="Estoque"
                      description="Controle de peças, periféricos e suprimentos"
                      icon={Package}
                    />
                  }
                />
                <Route
                  path="/orcamentos"
                  element={
                    <PlaceholderPage
                      title="Orçamentos"
                      description="Solicitações e aprovações de orçamento"
                      icon={FileText}
                    />
                  }
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
                <Route path="/metrics" element={<Metrics />} />
                <Route path="/triggers" element={<Triggers />} />
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
