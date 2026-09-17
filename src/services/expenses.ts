import { Query } from "appwrite";
import { appwriteConfig, functions, tables, TABLES } from "../lib/appwrite";
import { clearFastCache, readFastCache, writeFastCache } from "../lib/fast-cache";
import { createRecurrence } from "./recurrences";
import { payExpense as payExpenseOperation, reverseExpensePayment as reverseExpensePaymentOperation } from "./transactions";

let expensesCache: any[] | null = readFastCache<any[]>("expenses", 30 * 60 * 1000);
let expensesCacheAt = expensesCache ? Date.now() : 0;
let expensesRequest: Promise<any[]> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export function peekExpenses() { return expensesCache; }
export function invalidateExpensesCache() { expensesCache = null; expensesCacheAt = 0; expensesRequest = null; clearFastCache("expenses"); }

async function execute(action: string, payload: Record<string, unknown>) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Função financeira não configurada.");
  const execution = await functions.createExecution({
    functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }),
    async: false,
  });
  let body: Record<string, any> = {};
  try { body = execution.responseBody ? JSON.parse(execution.responseBody) : {}; } catch { body = {}; }
  const executionError = String((execution as unknown as { errors?: string }).errors || "").trim();
  if (execution.status !== "completed" || body.error) throw new Error(body.error || executionError || "Operação não concluída.");
  return body;
}

async function fetchExpenses() {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.expenses, queries: [Query.orderAsc("vencimento"), Query.limit(500)] });
  const rows = result.rows.map((x: any) => ({ ...x, id: x.$id, data_vencimento: x.vencimento, conta_bancaria_id: x.conta_id, comprovante_url: x.comprovante_id }));
  expensesCache = rows; expensesCacheAt = Date.now(); writeFastCache("expenses", rows); return rows;
}

export async function getExpenses(force = false) {
  if (!force && expensesCache && Date.now() - expensesCacheAt < CACHE_TTL) return expensesCache;
  if (!force && expensesRequest) return expensesRequest;
  expensesRequest = fetchExpenses().finally(() => { expensesRequest = null; });
  return expensesRequest;
}

export async function createExpenses(records: Record<string, any>[]) {
  const result = [];
  for (const record of records) {
    const response = await execute("createExpense", record);
    result.push(response.row || { id: response.id });
  }
  invalidateExpensesCache();
  return result;
}

export async function createExpenseWithOptionalRecurrence(data: Record<string, any>, months: number) {
  let recurrenceId = "";
  if (data.recorrente) {
    const due = new Date(`${data.data_vencimento}T12:00:00`);
    const recurrence = await createRecurrence({ descricao: data.descricao, categoria_id: data.categoria_id || "", conta_id: data.conta_bancaria_id || "", valor: Number(data.valor), dia_vencimento: due.getDate(), data_inicio: data.data_vencimento });
    recurrenceId = recurrence.id;
  }
  const records = [];
  for (let i = 0; i < (data.recorrente ? months : 1); i++) {
    const due = new Date(`${data.data_vencimento}T12:00:00`); due.setMonth(due.getMonth() + i);
    records.push({ ...data,
      descricao: data.recorrente ? `${data.descricao} - ${due.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}` : data.descricao,
      data_vencimento: due.toISOString().slice(0, 10),
      competencia: new Date(due.getFullYear(), due.getMonth(), 1, 12).toISOString().slice(0, 10),
      status: "pendente",
      recorrencia_id: recurrenceId,
    });
  }
  return createExpenses(records);
}

export async function payExpense(values: Record<string, unknown>) { const result = await payExpenseOperation(values); invalidateExpensesCache(); return result; }
export async function reverseExpensePayment(values: Record<string, unknown>) { const result = await reverseExpensePaymentOperation(values); invalidateExpensesCache(); return result; }
export async function deleteExpenseDirect(expenseId: string) { await execute("deleteExpense", { despesa_id: expenseId }); invalidateExpensesCache(); }
export async function findActivePayment(expenseId: string) {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.payments, queries: [Query.equal("despesa_id", expenseId), Query.equal("estornado", false), Query.limit(1)] });
  return result.rows[0] ? { ...result.rows[0], id: result.rows[0].$id } : null;
}
