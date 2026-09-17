import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

export type ManagedSystem = {
  id: string;
  orgao: string;
  tipo_orgao: string;
  sistema: string;
  dominio_url?: string;
  vercel_url?: string;
  acesso_url?: string;
  ambiente: string;
  status: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
};

export async function getManagedSystems() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.managedSystems,
    queries: [Query.orderAsc("orgao"), Query.limit(200)],
  });
  return result.rows.map((row: any) => ({ ...row, id: row.$id })) as ManagedSystem[];
}

export async function saveManagedSystem(values: Partial<ManagedSystem>) {
  const now = new Date().toISOString();
  const data = {
    orgao: values.orgao || "",
    tipo_orgao: values.tipo_orgao || "Prefeitura",
    sistema: values.sistema || "Gestão Licita",
    dominio_url: values.dominio_url || "",
    vercel_url: values.vercel_url || "",
    acesso_url: values.acesso_url || values.dominio_url || "",
    ambiente: values.ambiente || "Produção",
    status: values.status || "ativo",
    observacao: values.observacao || "",
    updated_at: now,
  };
  if (values.id) {
    const row: any = await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.managedSystems, rowId: values.id, data });
    return { ...row, id: row.$id } as ManagedSystem;
  }
  const row: any = await tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.managedSystems, rowId: ID.unique(), data: { ...data, created_at: now } });
  return { ...row, id: row.$id } as ManagedSystem;
}

export async function deleteManagedSystem(id: string) {
  await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.managedSystems, rowId: id });
}
