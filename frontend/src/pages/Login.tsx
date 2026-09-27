import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (user) return <Navigate to="/enquiries" replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setSaving(true);
    try { await login(email, password); navigate((location.state as { from?: string } | null)?.from ?? "/enquiries", { replace: true }); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again."); }
    finally { setSaving(false); }
  };
  return <div className="login-page"><div className="login-aside"><div className="brand brand-light"><span className="brand-mark">F</span><div><strong>Fundsroom</strong><small>Operations desk</small></div></div><div className="login-message"><span className="eyebrow">Industrial supply, in rhythm</span><h1>Move every order forward.</h1><p>A focused workspace for enquiries, quotations, inventory, and dispatch.</p></div><span className="login-stamp">ERP / 2026</span></div><main className="login-card"><div className="login-card-head"><span className="eyebrow">Secure workspace</span><h2>Welcome back</h2><p>Sign in to continue to your operations desk.</p></div><form onSubmit={submit}><label className="field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@fundsroom.local" required /></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>{error && <div className="notice notice-error" role="alert">{error}</div>}<button className="button button-primary button-wide" disabled={saving}>{saving ? "Signing in..." : "Sign in"}<span aria-hidden="true">→</span></button></form><p className="login-note">Access is controlled by your assigned role.</p></main></div>;
};
