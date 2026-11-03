import { Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

/** Read-only, paginated export. Never modifies Appwrite. */
const EXPORT_TABLES = {
  profiles: TABLES.profiles,
  accounts: TABLES.accounts,
  categories: TABLES.categories,
  counterparties: TABLES.counterparties,
  transactions: TABLES.transactions,
  expenses: TABLES.expenses,
  recurrences: TABLES.recurrences,
  payments: TABLES.payments,
  company: TABLES.company,
  idempotentOperations: TABLES.idempotentOperations,
  managedSystems: TABLES.managedSystems,
  teamAccess: TABLES.teamAccess,
} as const;

export type FinancialExport = {
  datasets: Record<string, unknown[]>;
  status: { table: string; rows: number; status: "ok" | "error"; error?: string }[];
  complete: boolean;
};

export async function exportFinancialAppwrite(): Promise<FinancialExport> {
  const datasets: Record<string, unknown[]> = {};
  const status: FinancialExport["status"] = [];
  for (const [name, tableId] of Object.entries(EXPORT_TABLES)) {
    const rows: unknown[] = [];
    let cursor: string | undefined;
    try {
      while (true) {
        const response = await tables.listRows({
          databaseId: appwriteConfig.databaseId,
          tableId,
          queries: [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
        });
        rows.push(...response.rows);
        if (response.rows.length < 100) break;
        const next = response.rows.at(-1)?.$id;
        if (!next || next === cursor) throw new Error("Paginação não avançou.");
        cursor = next;
        if (rows.length > 100000) throw new Error("Limite de exportação atingido; use exportação administrativa.");
      }
      datasets[name] = rows;
      status.push({ table: name, rows: rows.length, status: "ok" });
    } catch (error) {
      // A partial table must NOT be mistaken for an exhaustive backup.
      status.push({ table: name, rows: rows.length, status: "error", error: String(error) });
    }
  }
  return { datasets, status, complete: status.every(item => item.status === "ok") };
}
