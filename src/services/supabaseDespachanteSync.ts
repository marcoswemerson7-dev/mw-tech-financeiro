import { mwSupabaseData } from "../lib/mwSupabase";

type Snapshot = { clients: unknown[]; models: unknown[]; jobs: unknown[]; processes?: unknown[] };
function validate(x: unknown): x is Snapshot {
  if (!x || typeof x !== "object") return false;
  const v = x as Record<string, unknown>;
  return Array.isArray(v.clients) && Array.isArray(v.models) && Array.isArray(v.jobs)
    && (v.processes === undefined || Array.isArray(v.processes));
}
async function read() {
  const data = await mwSupabaseData("mw_control_snapshots?module=eq.despachante&select=payload,revision&limit=1");
  if (!Array.isArray(data) || !data.length) return null;
  const row = data[0] as { payload: unknown; revision: number };
  if (!validate(row.payload)) throw new Error("Os dados do MW Despachante na nuvem estão inválidos.");
  return { data: row.payload, revision: Number(row.revision) };
}
export async function downloadSupabaseDespachante(): Promise<Snapshot|null> {
  return (await read())?.data || null;
}
export async function supabaseDespachanteRevision(): Promise<string> {
  const row = await read();
  return row ? String(row.revision) : "";
}
export async function uploadSupabaseDespachante(data: Snapshot, expectedRevision?: string) {
  if (!validate(data)) throw new Error("Os dados do MW Despachante não são válidos.");
  if (expectedRevision !== undefined && !/^\d*$/.test(expectedRevision)) throw new Error("Revisão inválida.");
  const revision = expectedRevision === undefined ? (await read())?.revision || 0 : Number(expectedRevision || 0);
  try {
    const updated = await mwSupabaseData("rpc/mw_save_despachante_snapshot", {
      method: "POST",
      body: JSON.stringify({ p_payload: data, p_expected_revision: revision }),
    });
    if (typeof updated !== "number") throw new Error("O Supabase não confirmou a gravação.");
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("40001") || message.includes("Conflict")) {
      throw new Error("Conflito: outro aparelho atualizou o MW Despachante. Baixe a versão mais recente antes de enviar.");
    }
    throw error;
  }
}
