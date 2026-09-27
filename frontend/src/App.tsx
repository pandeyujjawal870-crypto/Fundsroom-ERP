import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { Login } from "./pages/Login";
import { Enquiries } from "./pages/Enquiries";
import { Quotations } from "./pages/Quotations";
import { SalesOrders } from "./pages/SalesOrders";
import { Inventory } from "./pages/Inventory";

export const App = () => <AuthProvider><Routes><Route path="/login" element={<Login />} /><Route element={<ProtectedRoute />}><Route element={<AppShell />}><Route index element={<Navigate to="/enquiries" replace />} /><Route path="enquiries" element={<Enquiries />} /><Route path="quotations" element={<Quotations />} /><Route path="sales-orders" element={<SalesOrders />} /><Route path="inventory" element={<Inventory />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider>;
