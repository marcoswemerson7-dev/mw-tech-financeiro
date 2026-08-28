import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Models } from "appwrite";
import { isAppwriteConfigured } from "./appwrite";
import { authService } from "../services/auth";

type Demo = { $id: string; email: string; name: string };
type AuthValue = { session: Models.User<Models.Preferences> | Demo | null; loading: boolean; enterDemo: () => void; logout: () => Promise<void>; refresh: () => Promise<void> };
const C = createContext<AuthValue>({ session: null, loading: true, enterDemo: () => {}, logout: async () => {}, refresh: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthValue["session"]>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    if (localStorage.getItem("mw-demo") === "1") { setSession({ $id: "demo", email: "demo@mwtech.local", name: "Demonstração" }); setLoading(false); return; }
    if (!isAppwriteConfigured) { setSession(null); setLoading(false); return; }
    try { setSession(await authService.current()); } catch { setSession(null); }
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, []);
  const enterDemo = () => { localStorage.setItem("mw-demo", "1"); void refresh(); };
  const logout = async () => { localStorage.removeItem("mw-demo"); if (isAppwriteConfigured && session?.$id !== "demo") await authService.logout().catch(() => undefined); setSession(null); };
  return <C.Provider value={{ session, loading, enterDemo, logout, refresh }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);
