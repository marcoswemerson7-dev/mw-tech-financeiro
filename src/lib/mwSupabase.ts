/** MW TECH Control / Supabase Auth. No service-role secrets in the client. */
const endpoint = String(import.meta.env.VITE_MW_SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = String(import.meta.env.VITE_MW_SUPABASE_PUBLISHABLE_KEY || "");
const STORAGE = "mw-control-supabase-auth-v1";
export const isMwSupabaseConfigured = Boolean(endpoint && publishableKey);
export const isMwSupabaseAuthEnabled = import.meta.env.VITE_MW_AUTH_PROVIDER === "supabase";

export type MwSupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string; user_metadata?: { name?: string } };
};
let refreshInProgress: Promise<MwSupabaseSession> | null = null;

function load(): MwSupabaseSession | null {
  try {
    const value = sessionStorage.getItem(STORAGE);
    return value ? JSON.parse(value) as MwSupabaseSession : null;
  } catch { return null; }
}
function save(value: MwSupabaseSession | null) {
  if (value) sessionStorage.setItem(STORAGE, JSON.stringify(value));
  else sessionStorage.removeItem(STORAGE);
}
function headers(token?: string): Record<string, string> {
  return { apikey: publishableKey, "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}) };
}
async function request(path: string, init: RequestInit = {}) {
  if (!isMwSupabaseConfigured) throw new Error("Conexão com o Supabase não configurada.");
  const response = await fetch(endpoint + path, { ...init, headers: { ...headers(), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error_description || data.msg || data.message || data.error;
    throw new Error(response.status === 400 || response.status === 401
      ? "E-mail ou senha inválidos, ou sessão expirada."
      : String(detail || "Não foi possível acessar o Supabase."));
  }
  return data as Record<string, any>;
}
function toSession(value: Record<string, any>): MwSupabaseSession {
  if (!value.access_token || !value.refresh_token || !value.user?.id) throw new Error("Sessão Supabase inválida.");
  return {
    access_token: String(value.access_token), refresh_token: String(value.refresh_token),
    expires_at: Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600),
    user: { id: String(value.user.id), email: String(value.user.email || ""), user_metadata: value.user.user_metadata },
  };
}
export async function mwSupabaseSignIn(email: string, password: string) {
  if (!email.includes("@")) throw new Error("Entre com o e-mail cadastrado no Supabase.");
  const session = toSession(await request("/auth/v1/token?grant_type=password", {
    method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  }));
  save(session);
  return session;
}
export async function mwSupabaseCurrent(): Promise<MwSupabaseSession | null> {
  const existing = load();
  if (!existing) return null;
  if (existing.expires_at > Math.floor(Date.now() / 1000) + 60) return existing;
  if (!refreshInProgress) {
    refreshInProgress = (async () => {
      const next = toSession(await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST", body: JSON.stringify({ refresh_token: existing.refresh_token }),
      }));
      save(next);
      return next;
    })().catch(error => { save(null); throw error; }).finally(() => { refreshInProgress = null; });
  }
  return refreshInProgress;
}
export async function mwSupabaseAccessToken(): Promise<string> {
  const current = await mwSupabaseCurrent();
  if (!current) throw new Error("Entre no sistema para sincronizar o MW Despachante.");
  return current.access_token;
}
export async function mwSupabaseSignOut() {
  const existing = load();
  save(null);
  if (existing) await fetch(endpoint + "/auth/v1/logout", {
    method: "POST", headers: headers(existing.access_token),
  }).catch(() => undefined);
}
export async function mwSupabaseData(path: string, init: RequestInit = {}) {
  const token = await mwSupabaseAccessToken();
  const response = await fetch(endpoint + "/rest/v1/" + path, {
    ...init, headers: { ...headers(token), ...init.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(result.message || result.error || "Falha ao consultar o Supabase") + " (" + response.status + ")");
  return result;
}
