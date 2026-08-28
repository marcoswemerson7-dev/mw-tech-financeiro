import { Query } from "appwrite";
import { appwriteConfig, functions, tables, TABLES } from "../lib/appwrite";
import { getAccounts, invalidateAccountsCache } from "./accounts";

export type Movement = {
  id: string; tipo: string; data: string; descricao: string; valor: number;
  observacao?: string; created_at: string; conta_id?: string; categoria_id?: string;
  contas_bancarias?: { nome: string } | null; categorias_financeiras?: { nome: string } | null;
};

const movementCache = new Map<number, { at: number; rows: Movement[] }>();
const CACHE_TTL = 2 * 60 * 1000;

export function peekMovements(limit = 100) {
  return movementCache.get(limit)?.rows || null;
}

export function invalidateMovementsCache() {
  movementCache.clear();
}

export async function getMovements(limit = 100, force = false) {
  const cached = movementCache.get(limit);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.rows;
  const [result, accounts, categories] = await Promise.all([
    tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions,
      queries: [Query.orderDesc("data"), Query.limit(limit)] }),
    getAccounts(),
    tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.categories, queries: [Query.limit(200)] }),
  ]);
  const rows = result.rows.map((row: any) => ({ ...row, id: row.$id,
    contas_bancarias: accounts.find((x) => x.id === row.conta_id) ? { nome: accounts.find((x) => x.id === row.conta_id)!.nome } : null,
    categorias_financeiras: categories.rows.find((x: any) => x.$id === row.categoria_id) ? { nome: (categories.rows.find((x: any) => x.$id === row.categoria_id) as any).nome } : null,
  })) as Movement[];
  movementCache.set(limit, { at: Date.now(), rows });
  return rows;
}
async function execute(action: string, payload: Record<string, unknown>) {
  if (!appwriteConfig.financialFunctionId) {
    throw new Error("Configure VITE_APPWRITE_FINANCIAL_FUNCTION_ID para executar operações financeiras.");
  }
  const execution = await functions.createExecution({ functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }), async: false });
  const body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  if (execution.status !== "completed" || body.error) throw new Error(body.error || "Operação financeira não concluída.");
  invalidateMovementsCache();
  invalidateAccountsCache();
  return body;
}
export const registerMovement = (values: Record<string, unknown>) => execute(values.tipo === "transferencia" ? "transfer" : "registerMovement", values);
export const payExpense = (values: Record<string, unknown>) => execute("payExpense", values);
export const reverseExpensePayment = (values: Record<string, unknown>) => execute("reverseExpensePayment", values);
