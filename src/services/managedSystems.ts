import { ID, Query } from "appwrite";
import { appwriteConfig, functions, storage, tables, TABLES } from "../lib/appwrite";

export type ManagedSystem = {
  id: string;
  orgao: string;
  tipo_orgao: string;
  sistema: string;
  dominio_url?: string;
  vercel_url?: string;
  supabase_url?: string;
  acesso_url?: string;
  logo_url?: string;
  ambiente: string;
  status: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
};

type SystemMeta = {
  notes?: string;
  supabase_url?: string;
  logo_url?: string;
  orgao?: string;
  tipo_orgao?: string;
  sistema?: string;
  dominio_url?: string;
  vercel_url?: string;
  acesso_url?: string;
  ambiente?: string;
  status?: string;
};

const FALLBACK_TYPE = "sistema_orgao";
const CACHE_KEY = "mw-control:managed-systems-cache:v1";
const CACHE_TTL = 5 * 60 * 1000;
let memoryCache: { rows: ManagedSystem[]; timestamp: number } | null = null;
let inflight: Promise<ManagedSystem[]> | null = null;

function readCache() {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) return memoryCache.rows;
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (parsed?.timestamp && Array.isArray(parsed.rows) && Date.now() - parsed.timestamp < CACHE_TTL) {
      memoryCache = parsed;
      return parsed.rows as ManagedSystem[];
    }
  } catch {
    // Cache inválido não pode impedir a leitura real.
  }
  return null;
}

function writeCache(rows: ManagedSystem[]) {
  memoryCache = { rows, timestamp: Date.now() };
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    // O sistema continua funcionando mesmo sem storage disponível.
  }
}

export function getManagedSystemsCached() {
  return readCache();
}

async function execute(action: string, payload: Record<string, unknown> = {}) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Função administrativa não configurada.");
  const execution = await functions.createExecution({
    functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, idempotencyKey: ID.unique(), ...payload }),
    async: false,
  });
  let body: Record<string, any> = {};
  try {
    body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  } catch {
    body = {};
  }
  if (execution.status !== "completed" || body.error) {
    const executionError = String((execution as unknown as { errors?: string }).errors || "").trim();
    throw new Error(body.error || executionError || "Operação não concluída.");
  }
  return body;
}

function parseMeta(value?: string): SystemMeta {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && (parsed.__mw_control_meta === true || parsed.__mw_control_system_fallback === true)) {
      return {
        notes: String(parsed.notes || ""),
        supabase_url: String(parsed.supabase_url || ""),
        logo_url: String(parsed.logo_url || ""),
        orgao: String(parsed.orgao || ""),
        tipo_orgao: String(parsed.tipo_orgao || ""),
        sistema: String(parsed.sistema || ""),
        dominio_url: String(parsed.dominio_url || ""),
        vercel_url: String(parsed.vercel_url || ""),
        acesso_url: String(parsed.acesso_url || ""),
        ambiente: String(parsed.ambiente || ""),
        status: String(parsed.status || ""),
      };
    }
  } catch {
    // Registros antigos guardavam somente texto livre em observacao.
  }
  return { notes: value };
}

function serializeMeta(values: Partial<ManagedSystem>) {
  return JSON.stringify({
    __mw_control_meta: true,
    notes: values.observacao || "",
    supabase_url: values.supabase_url || "",
    logo_url: values.logo_url || "",
  });
}

function serializeFallback(values: Partial<ManagedSystem>) {
  return JSON.stringify({
    __mw_control_system_fallback: true,
    orgao: values.orgao || "",
    tipo_orgao: values.tipo_orgao || "Prefeitura",
    sistema: values.sistema || "Gestão Licita",
    dominio_url: values.dominio_url || "",
    vercel_url: values.vercel_url || "",
    supabase_url: values.supabase_url || "",
    acesso_url: values.acesso_url || values.dominio_url || "",
    logo_url: values.logo_url || "",
    ambiente: values.ambiente || "Produção",
    status: values.status || "ativo",
    notes: values.observacao || "",
  });
}

const normalize = (row: any): ManagedSystem => {
  const meta = parseMeta(row.observacao);
  return {
    ...row,
    id: row.$id || row.id,
    orgao: meta.orgao || row.orgao || row.nome || "",
    tipo_orgao: meta.tipo_orgao || row.tipo_orgao || "Prefeitura",
    sistema: meta.sistema || row.sistema || "Gestão Licita",
    dominio_url: meta.dominio_url || row.dominio_url || "",
    vercel_url: meta.vercel_url || row.vercel_url || "",
    acesso_url: meta.acesso_url || row.acesso_url || "",
    ambiente: meta.ambiente || row.ambiente || "Produção",
    status: meta.status || row.status || (row.ativo === false ? "inativo" : "ativo"),
    observacao: meta.notes || "",
    supabase_url: meta.supabase_url || "",
    logo_url: meta.logo_url || "",
    created_at: row.created_at || row.$createdAt || new Date().toISOString(),
    updated_at: row.updated_at || row.$updatedAt || row.$createdAt || new Date().toISOString(),
  };
};

function missingAdminTable(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return message.includes("sistemas_orgaos") && (message.includes("not be found") || message.includes("could not be found") || message.includes("requested id"));
}

async function fallbackList() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries: [Query.equal("tipo", FALLBACK_TYPE), Query.orderAsc("nome"), Query.limit(200)],
  });
  return result.rows.map(normalize);
}

async function fallbackSave(values: Partial<ManagedSystem>) {
  if (!String(values.orgao || "").trim()) throw new Error("Informe o órgão.");
  const now = new Date().toISOString();
  const payload = {
    nome: String(values.orgao || "").trim(),
    tipo: FALLBACK_TYPE,
    documento: "",
    observacao: serializeFallback(values),
    ativo: values.status !== "inativo",
  };
  const row = values.id
    ? await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: values.id, data: payload })
    : await tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: ID.unique(), data: { ...payload, created_at: now } });
  return normalize(row);
}

async function fallbackDelete(id: string) {
  await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: id });
}

async function fetchManagedSystems() {
  try {
    const body = await execute("listSystems");
    const rows = (body.rows || []).map(normalize);
    writeCache(rows);
    return rows;
  } catch (error) {
    if (!missingAdminTable(error)) throw error;
    const rows = await fallbackList();
    writeCache(rows);
    return rows;
  }
}

export async function getManagedSystems(force = false) {
  const cached = !force ? readCache() : null;
  if (cached) {
    if (!inflight) {
      inflight = fetchManagedSystems().finally(() => { inflight = null; });
    }
    return cached;
  }
  if (!inflight) inflight = fetchManagedSystems().finally(() => { inflight = null; });
  return inflight;
}

export async function saveManagedSystem(values: Partial<ManagedSystem>) {
  const payload = {
    id: values.id,
    orgao: values.orgao,
    tipo_orgao: values.tipo_orgao,
    sistema: values.sistema,
    dominio_url: values.dominio_url,
    vercel_url: values.vercel_url,
    acesso_url: values.acesso_url,
    ambiente: values.ambiente,
    status: values.status,
    observacao: serializeMeta(values),
  };
  let saved: ManagedSystem;
  try {
    const body = await execute("saveSystem", payload);
    saved = normalize(body.row);
  } catch (error) {
    if (!missingAdminTable(error)) throw error;
    saved = await fallbackSave(values);
  }
  const current = readCache() || [];
  writeCache(values.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
  return saved;
}

export async function uploadSystemLogo(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 3 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 3 MB.");
  const uploaded = await storage.createFile({
    bucketId: appwriteConfig.receiptsBucketId,
    fileId: ID.unique(),
    file,
  });
  return storage.getFileView({
    bucketId: appwriteConfig.receiptsBucketId,
    fileId: uploaded.$id,
  }).toString();
}

export async function deleteManagedSystem(id: string) {
  try {
    await execute("deleteSystem", { id });
  } catch (error) {
    if (!missingAdminTable(error)) throw error;
    await fallbackDelete(id);
  }
  writeCache((readCache() || []).filter((item) => item.id !== id));
}
