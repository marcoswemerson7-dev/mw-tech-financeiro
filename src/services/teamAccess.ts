import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

export const ACCESS_MODULES = [
  ["dashboard", "Visão geral"],
  ["financeiro", "Financeiro"],
  ["sistemas", "Sistemas e órgãos"],
  ["usuarios", "Usuários e acessos"],
  ["armazenamento", "Armazenamento"],
  ["suporte", "Central de suporte"],
  ["configuracoes", "Configurações"],
] as const;

export type TeamAccess = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  status: string;
  modulos: string[];
  created_at: string;
  updated_at: string;
};

const normalize = (row: any): TeamAccess => ({
  ...row,
  id: row.$id,
  modulos: (() => { try { return JSON.parse(row.modulos || "[]"); } catch { return []; } })(),
});

export async function getTeamAccess() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.teamAccess,
    queries: [Query.orderAsc("nome"), Query.limit(200)],
  });
  return result.rows.map(normalize);
}

export async function saveTeamAccess(values: Partial<TeamAccess>) {
  const now = new Date().toISOString();
  const data = {
    nome: values.nome || "",
    email: values.email || "",
    cargo: values.cargo || "Colaborador",
    status: values.status || "ativo",
    modulos: JSON.stringify(values.modulos || []),
    updated_at: now,
  };
  if (values.id) {
    const row: any = await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.teamAccess, rowId: values.id, data });
    return normalize(row);
  }
  const row: any = await tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.teamAccess, rowId: ID.unique(), data: { ...data, created_at: now } });
  return normalize(row);
}

export async function deleteTeamAccess(id: string) {
  await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.teamAccess, rowId: id });
}
