import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const AppShell = () => {
  const { user, logout } = useAuth();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">F</span><div><strong>Fundsroom</strong><small>Operations desk</small></div></div>
      <nav aria-label="Primary navigation">
        <span className="nav-label">Workflows</span>
        <NavLink to="/enquiries"><span>01</span> Enquiries</NavLink>
        <NavLink to="/quotations"><span>02</span> Quotations</NavLink>
        <NavLink to="/sales-orders"><span>03</span> Sales Orders</NavLink>
        <NavLink to="/inventory"><span>04</span> Inventory</NavLink>
      </nav>
      <div className="sidebar-foot"><div className="user-chip"><span className="avatar">{user?.fullName.slice(0, 1)}</span><div><strong>{user?.fullName}</strong><small>{user?.role} access</small></div></div><button className="button button-quiet" onClick={logout}>Log out <span aria-hidden="true">↗</span></button></div>
    </aside>
    <main className="main-content"><header className="mobile-header"><span className="brand-mark">F</span><strong>Fundsroom</strong><button className="button button-quiet" onClick={logout}>Log out</button></header><Outlet /></main>
  </div>;
};
