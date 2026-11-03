import { account } from "../lib/appwrite";
import { appwriteConfig } from "../lib/appwrite";

/** Uses the existing MW TECH Control login. Appwrite JWT is validated by
 * the Supabase Edge Function, never by trusting a user-supplied ID. */
const ENDPOINT = String(import.meta.env.VITE_MW_SUPABASE_URL || "").replace(/\/$/, "");
export const despachanteCloudConfigured = Boolean(ENDPOINT && appwriteConfig.projectId);
type Snapshot = { clients: unknown[]; models: unknown[]; jobs: unknown[]; processes?: unknown[] };
function valid(data: unknown): data is Snapshot {
 if (!data || typeof data !== "object") return false;
 const x = data as Record<string, unknown>;
 return Array.isArray(x.clients) && Array.isArray(x.models) && Array.isArray(x.jobs)
   && (x.processes === undefined || Array.isArray(x.processes));
}
async function bridge(action: "read"|"revision"|"save", payload?: Snapshot, expectedRevision?: number) {
 if (!despachanteCloudConfigured) throw new Error("Sincronização Supabase ainda não configurada.");
 const jwt = await account.createJWT();
 const response = await fetch(ENDPOINT + "/functions/v1/mw-despachante-appwrite-bridge", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Appwrite-JWT": jwt.jwt },
  body: JSON.stringify({ action, payload, expectedRevision }),
 });
 const data = await response.json().catch(() => ({})) as Record<string, unknown>;
 if (!response.ok) {
  if (response.status === 409) throw new Error("Conflito: outro aparelho atualizou os dados; sincronize novamente.");
  throw new Error(String(data.error || "Não foi possível sincronizar com Supabase.") + " (" + response.status + ")");
 }
 return data;
}
export async function despachanteCloudSession() {
 const current = await account.get();
 return { user: { id: current.$id, email: current.email } };
}
export async function downloadDespachante(): Promise<Snapshot|null> {
 const result = await bridge("read");
 if (result.payload == null) return null;
 if (!valid(result.payload)) throw new Error("Dados inválidos recebidos do Supabase.");
 return result.payload;
}
export async function cloudRevision(): Promise<string> {
 const result = await bridge("revision");
 return String(result.revision || "");
}
export async function uploadDespachante(data: Snapshot, expectedRevision?: string) {
 if (!valid(data)) throw new Error("Dados inválidos para sincronização.");
 const revision = Number(expectedRevision || 0);
 if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Revisão inválida.");
 const result = await bridge("save",data,revision);
 return String(result.revision || "");
}
