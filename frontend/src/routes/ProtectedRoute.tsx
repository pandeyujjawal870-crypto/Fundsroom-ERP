import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/ui";

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Restoring your session..." />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
};
