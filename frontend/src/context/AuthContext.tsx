import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/resources";
import type { User } from "../types";

type AuthContextValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("fundsroom_user");
    return stored ? JSON.parse(stored) as User : null;
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("fundsroom_access_token")));

  const logout = () => {
    localStorage.removeItem("fundsroom_access_token");
    localStorage.removeItem("fundsroom_user");
    setUser(null);
  };

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("fundsroom:unauthorized", handleUnauthorized);
    if (localStorage.getItem("fundsroom_access_token")) authApi.me().then(({ user: nextUser }) => {
      setUser(nextUser);
      localStorage.setItem("fundsroom_user", JSON.stringify(nextUser));
    }).catch(logout).finally(() => setLoading(false));
    return () => window.removeEventListener("fundsroom:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    localStorage.setItem("fundsroom_access_token", result.token);
    localStorage.setItem("fundsroom_user", JSON.stringify(result.user));
    setUser(result.user);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
