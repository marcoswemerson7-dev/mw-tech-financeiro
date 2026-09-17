import { ID } from "appwrite";
import { appwriteConfig, functions, storage } from "../lib/appwrite";

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
};

async function execute(action: string, payload: Record<string, unknown> = {}) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Função administrativa não configurada.");
  const execution = await functions.createExecution({
    functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, ...payload }),
    async: false,
  });
  const body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  if (execution.status !== "completed" || body.error) {
    throw new Error(body.error || "Operação não concluída.");
  }
  return body;
}

function parseMeta(value?: string): SystemMeta {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.__mw_control_meta === true) {
      return {
        notes: String(parsed.notes || ""),
        supabase_url: String(parsed.supabase_url || ""),
        logo_url: String(parsed.logo_url || ""),
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

const normalize = (row: any): ManagedSystem => {
  const meta = parseMeta(row.observacao);
  return {
    ...row,
    id: row.$id || row.id,
    observacao: meta.notes || "",
    supabase_url: meta.supabase_url || "",
    logo_url: meta.logo_url || "",
  };
};

export async function getManagedSystems() {
  const body = await execute("listSystems");
  return (body.rows || []).map(normalize);
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
  const body = await execute("saveSystem", payload);
  return normalize(body.row);
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
  await execute("deleteSystem", { id });
}
