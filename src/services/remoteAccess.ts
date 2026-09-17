import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

export type RemoteDevice = {
  id: string;
  orgao: string;
  setor?: string;
  usuario?: string;
  dispositivo: string;
  anydesk_id: string;
  observacao?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

const TYPE = "anydesk_device";

type RemoteMeta = {
  __mw_control_anydesk?: boolean;
  orgao?: string;
  setor?: string;
  usuario?: string;
  dispositivo?: string;
  anydesk_id?: string;
  observacao?: string;
};

function normalize(row: any): RemoteDevice {
  let meta: RemoteMeta = {};
  try {
    meta = JSON.parse(String(row.observacao || "{}"));
  } catch {
    meta = {};
  }
  return {
    id: row.$id || row.id,
    orgao: String(meta.orgao || row.nome || ""),
    setor: String(meta.setor || ""),
    usuario: String(meta.usuario || ""),
    dispositivo: String(meta.dispositivo || row.nome || ""),
    anydesk_id: String(meta.anydesk_id || row.documento || ""),
    observacao: String(meta.observacao || ""),
    ativo: row.ativo !== false,
    created_at: row.created_at || row.$createdAt || new Date().toISOString(),
    updated_at: row.updated_at || row.$updatedAt || row.$createdAt || new Date().toISOString(),
  };
}

function serialize(values: Partial<RemoteDevice>) {
  return JSON.stringify({
    __mw_control_anydesk: true,
    orgao: String(values.orgao || "").trim(),
    setor: String(values.setor || "").trim(),
    usuario: String(values.usuario || "").trim(),
    dispositivo: String(values.dispositivo || "").trim(),
    anydesk_id: String(values.anydesk_id || "").trim(),
    observacao: String(values.observacao || "").trim(),
  });
}

export async function getRemoteDevices() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries: [Query.equal("tipo", TYPE), Query.orderAsc("nome"), Query.limit(300)],
  });
  return result.rows.map(normalize);
}

export async function saveRemoteDevice(values: Partial<RemoteDevice>) {
  const orgao = String(values.orgao || "").trim();
  const dispositivo = String(values.dispositivo || "").trim();
  const anydeskId = String(values.anydesk_id || "").trim();
  if (!orgao) throw new Error("Informe o órgão.");
  if (!dispositivo) throw new Error("Informe o nome do computador/dispositivo.");
  if (!anydeskId) throw new Error("Informe o ID ou Alias do AnyDesk.");

  const payload = {
    nome: dispositivo,
    tipo: TYPE,
    documento: anydeskId,
    observacao: serialize(values),
    ativo: values.ativo !== false,
  };

  const row = values.id
    ? await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: values.id, data: payload })
    : await tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: ID.unique(), data: { ...payload, created_at: new Date().toISOString() } });

  return normalize(row);
}

export async function deleteRemoteDevice(id: string) {
  await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.counterparties, rowId: id });
}

export function anyDeskUrl(address: string) {
  const clean = String(address || "").trim().replace(/\s+/g, "");
  return `anydesk:${clean}`;
}
