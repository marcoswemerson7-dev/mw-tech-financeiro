import { ID, Query } from "appwrite";
import { appwriteConfig, storage, tables, TABLES } from "../lib/appwrite";

export type CompanyCertificate = {
  id: string;
  nome: string;
  orgao: string;
  categoria: string;
  emissao?: string;
  validade?: string;
  status: "valida" | "atencao" | "vencida" | "sem_validade";
  url_emissao?: string;
  arquivo_url?: string;
  arquivo_id?: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
};

type CertificateMeta = Omit<CompanyCertificate, "id" | "nome" | "created_at" | "updated_at"> & {
  __mw_control_certificate: true;
};

const TYPE = "certidao_empresa";

function parseMeta(value?: string): Partial<CertificateMeta> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed?.__mw_control_certificate === true ? parsed : {};
  } catch {
    return {};
  }
}

function computeStatus(validade?: string): CompanyCertificate["status"] {
  if (!validade) return "sem_validade";
  const end = new Date(validade + "T23:59:59");
  if (Number.isNaN(end.getTime())) return "sem_validade";
  const diff = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (diff < 0) return "vencida";
  if (diff <= 30) return "atencao";
  return "valida";
}

function normalize(row: any): CompanyCertificate {
  const meta = parseMeta(row.observacao);
  const validade = String(meta.validade || "");
  return {
    id: row.$id || row.id,
    nome: String(row.nome || ""),
    orgao: String(meta.orgao || ""),
    categoria: String(meta.categoria || "Outras"),
    emissao: String(meta.emissao || ""),
    validade,
    status: computeStatus(validade),
    url_emissao: String(meta.url_emissao || ""),
    arquivo_url: String(meta.arquivo_url || ""),
    arquivo_id: String(meta.arquivo_id || ""),
    observacao: String(meta.observacao || ""),
    created_at: row.created_at || row.$createdAt || new Date().toISOString(),
    updated_at: row.updated_at || row.$updatedAt || row.$createdAt || new Date().toISOString(),
  };
}

function serialize(values: Partial<CompanyCertificate>, arquivo?: { id: string; url: string }) {
  return JSON.stringify({
    __mw_control_certificate: true,
    orgao: values.orgao || "",
    categoria: values.categoria || "Outras",
    emissao: values.emissao || "",
    validade: values.validade || "",
    status: computeStatus(values.validade),
    url_emissao: values.url_emissao || "",
    arquivo_url: arquivo?.url || values.arquivo_url || "",
    arquivo_id: arquivo?.id || values.arquivo_id || "",
    observacao: values.observacao || "",
  } satisfies CertificateMeta);
}

export async function listCertificates() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries: [Query.equal("tipo", TYPE), Query.orderAsc("nome"), Query.limit(200)],
  });
  return result.rows.map(normalize);
}

async function uploadCertificateFile(file: File) {
  if (file.type !== "application/pdf") throw new Error("Envie a certidão em PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 10 MB.");
  const uploaded = await storage.createFile({
    bucketId: appwriteConfig.receiptsBucketId,
    fileId: ID.unique(),
    file,
  });
  const url = storage.getFileView({
    bucketId: appwriteConfig.receiptsBucketId,
    fileId: uploaded.$id,
  }).toString();
  return { id: uploaded.$id, url };
}

export async function saveCertificate(values: Partial<CompanyCertificate>, file?: File | null) {
  if (!String(values.nome || "").trim()) throw new Error("Informe o nome da certidão.");
  const existing = values.id
    ? await tables.getRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: values.id })
    : null;
  const current = existing ? normalize(existing) : null;
  const uploaded = file ? await uploadCertificateFile(file) : undefined;
  const now = new Date().toISOString();

  const data = {
    nome: String(values.nome || "").trim(),
    tipo: TYPE,
    documento: String(values.orgao || ""),
    observacao: serialize({ ...current, ...values }, uploaded),
    ativo: true,
    ...(existing ? {} : { created_at: now }),
  };

  const row = existing
    ? await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.counterparties,
        rowId: values.id!,
        data,
      })
    : await tables.createRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.counterparties,
        rowId: ID.unique(),
        data,
      });

  if (uploaded && current?.arquivo_id) {
    try {
      await storage.deleteFile({ bucketId: appwriteConfig.receiptsBucketId, fileId: current.arquivo_id });
    } catch {
      // O novo PDF já foi salvo; falha ao remover versão antiga não bloqueia o cadastro.
    }
  }
  return normalize(row);
}

export async function deleteCertificate(item: CompanyCertificate) {
  await tables.deleteRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    rowId: item.id,
  });
  if (item.arquivo_id) {
    try {
      await storage.deleteFile({ bucketId: appwriteConfig.receiptsBucketId, fileId: item.arquivo_id });
    } catch {
      // O registro principal já foi excluído.
    }
  }
}

export function certificateDaysRemaining(validade?: string) {
  if (!validade) return null;
  const end = new Date(validade + "T23:59:59");
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}
