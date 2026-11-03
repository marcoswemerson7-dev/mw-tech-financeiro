/** MW Despachante: isolated Supabase session (no changes to Appwrite login). */
const SUPABASE_URL = String(import.meta.env.VITE_MW_SUPABASE_URL || "").replace(/\/$/, "");
const PUBLIC_KEY = String(import.meta.env.VITE_MW_SUPABASE_PUBLISHABLE_KEY || "");
const SESSION_KEY = "mw-despachante-supabase-session-v1";

export const despachanteCloudConfigured = Boolean(SUPABASE_URL && PUBLIC_KEY);
type SupabaseSession = {
  access_token: string; refresh_token: string; expires_at: number;
  user: { id: string; email: string };
};
export type DespachanteSnapshot = {
  clients: unknown[]; models: unknown[]; jobs: unknown[]; processes?: unknown[];
};
let refreshing: Promise<SupabaseSession | null> | null = null;

function validSnapshot(value: unknown): value is DespachanteSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.clients) && Array.isArray(item.models)
    && Array.isArray(item.jobs) && (item.processes === undefined || Array.isArray(item.processes));
}
function stored(): SupabaseSession | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as SupabaseSession | null; }
  catch { return null; }
}
function persist(session: SupabaseSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}
function headers(token?: string): HeadersInit {
  return {
    apikey: PUBLIC_KEY, "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
}
async function authRequest(route: string, body: Record<string, unknown>): Promise<Record<string, any>> {
  if (!despachanteCloudConfigured) throw new Error("Supabase do MW Despachante não configurado.");
  const response = await fetch(SUPABASE_URL + "/auth/v1/" + route, {
    method: "POST", headers: headers(), body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw new Error("E-mail ou senha incorretos, ou conta não confirmada.");
    throw new Error(String(data.msg || data.message || data.error_description || "Falha ao autenticar."));
  }
  return data;
}
function parseSession(data: Record<string, any>): SupabaseSession {
  if (!data.access_token || !data.refresh_token || !data.user?.id)
    throw new Error("Sessão Supabase incompleta.");
  return {
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token),
    expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: { id: String(data.user.id), email: String(data.user.email || "") },
  };
}

export async function despachanteCloudLogin(email: string, password: string) {
  if (!email.includes("@")) throw new Error("Informe o e-mail cadastrado no Supabase.");
  const next = parseSession(await authRequest("token?grant_type=password", {
    email: email.trim().toLowerCase(), password,
  }));
  const linkedOwner = localStorage.getItem("mw-despachante-linked-owner");
  if (linkedOwner && linkedOwner !== next.user.id) {
    throw new Error("Este aparelho já possui dados vinculados a outra conta. Faça backup antes de trocar o usuário.");
  }
  persist(next);
  return next.user;
}
export async function despachanteCloudSession(): Promise<SupabaseSession | null> {
  const current = stored();
  if (!current || !despachanteCloudConfigured) return null;
  if (current.expires_at > Date.now() / 1000 + 60) return current;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const next = parseSession(await authRequest("token?grant_type=refresh_token", {
          refresh_token: current.refresh_token,
        }));
        persist(next);
        return next;
      } catch {
        persist(null);
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}
export async function despachanteCloudLogout() {
  const current = stored();
  persist(null);
  if (current) await fetch(SUPABASE_URL + "/auth/v1/logout", {
    method: "POST", headers: headers(current.access_token),
  }).catch(() => undefined);
}
async function dataRequest(path: string, init: RequestInit = {}) {
  const session = await despachanteCloudSession();
  if (!session) throw new Error("Conecte sua conta Supabase no MW Despachante para sincronizar.");
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init, headers: { ...headers(session.access_token), ...init.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.message || data.error || "Falha na sincronização") + " (" + (data.code || response.status) + ")");
  return data;
}
async function readSnapshot() {
  const data = await dataRequest("mw_control_snapshots?module=eq.despachante&select=payload,revision&limit=1");
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { payload: unknown; revision: number };
  if (!validSnapshot(row.payload)) throw new Error("Dados do Despachante na nuvem estão inválidos.");
  return { payload: row.payload, revision: Number(row.revision) };
}
export async function downloadDespachante(): Promise<DespachanteSnapshot | null> {
  return (await readSnapshot())?.payload || null;
}
export async function cloudRevision(): Promise<string> {
  const item = await readSnapshot();
  return item ? String(item.revision) : "";
}
export async function uploadDespachante(data: DespachanteSnapshot, expectedRevision?: string) {
  if (!validSnapshot(data)) throw new Error("Conteúdo inválido para sincronização.");
  if (expectedRevision !== undefined && !/^\d*$/.test(expectedRevision))
    throw new Error("Revisão inválida para sincronização.");
  const revision = expectedRevision === undefined ? (await readSnapshot())?.revision || 0 : Number(expectedRevision || 0);
  try {
    const result = await dataRequest("rpc/mw_save_despachante_snapshot", {
      method: "POST", body: JSON.stringify({ p_payload: data, p_expected_revision: revision }),
    });
    if (typeof result !== "number") throw new Error("O banco não confirmou a gravação.");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("40001") || message.includes("Conflict"))
      throw new Error("Outro aparelho atualizou os dados. Atualize e revise as alterações antes de sincronizar novamente.");
    throw error;
  }
}
