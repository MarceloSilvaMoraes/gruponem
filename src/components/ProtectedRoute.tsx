import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({
  children,
  adminOnly = false,
  staffOnly = false,
}: {
  children: JSX.Element;
  adminOnly?: boolean;
  staffOnly?: boolean;
}) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (adminOnly && role !== "admin") return <Navigate to="/" replace />;
  if (staffOnly && role !== "admin" && role !== "attendant")
    return <Navigate to="/meus-chamados" replace />;
  if (role === "end_user") return <Navigate to="/meus-chamados" replace />;
  return children;
}