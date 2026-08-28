import { Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";
import { getAccounts } from "./accounts";
import { getMovements } from "./transactions";

export async function getCompanySettings() {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.company, queries: [Query.limit(1)] });
  return result.rows[0] ? { ...result.rows[0], id: result.rows[0].$id } : {};
}
export async function saveCompanySettings(data: Record<string, unknown>, id?: string) {
  return id ? tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.company, rowId: id, data })
    : tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.company, rowId: "empresa", data });
}
export async function getReportData() {
  const [movements, accounts, company] = await Promise.all([getMovements(500), getAccounts(), getCompanySettings()]);
  return { movements, accounts, company };
}
