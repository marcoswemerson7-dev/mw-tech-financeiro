import { Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";
import { getAccounts } from "./accounts";
import type { Movement } from "./transactions";

export async function getCompanySettings() {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.company, queries: [Query.limit(1)] });
  return result.rows[0] ? { ...result.rows[0], id: result.rows[0].$id } : {};
}
export async function saveCompanySettings(data: Record<string, unknown>, id?: string) {
  return id ? tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.company, rowId: id, data })
    : tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.company, rowId: "empresa", data });
}
// Read every page for reports; the dashboard cache intentionally contains only recent rows.
async function getReportRows(tableId: string, order: string) {
  const rows = [];
  let cursor = "";
  while (true) {
    const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId,
      queries: [Query.orderDesc(order), Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    rows.push(...result.rows);
    if (result.rows.length < 100) return rows;
    cursor = result.rows[result.rows.length - 1].$id;
  }
}

export async function getReportData() {
  const [rows, categories, accounts, company] = await Promise.all([
    getReportRows(TABLES.transactions, "data"), getReportRows(TABLES.categories, "$id"), getAccounts(), getCompanySettings(),
  ]);
  const categoryNames = new Map(categories.map((x) => [x.$id, String(x.nome)]));
  const movements = rows.map((row) => ({ ...row, id: row.$id, tipo: String(row.tipo), data: String(row.data), descricao: String(row.descricao || ""), valor: Number(row.valor), created_at: row.$createdAt,
    categorias_financeiras: categoryNames.has(String(row.categoria_id)) ? { nome: categoryNames.get(String(row.categoria_id))! } : null,
  })) as Movement[];
  return { movements, accounts, company };
}
