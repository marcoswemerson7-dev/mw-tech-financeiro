import { ID, Query } from "appwrite";
import { account, appwriteConfig, tables, TABLES } from "../lib/appwrite";
import { clearFastCache, readFastCache, writeFastCache } from "../lib/fast-cache";
import { createRecurrence } from "./recurrences";
import { payExpense as payExpenseOperation, reverseExpensePayment as reverseExpensePaymentOperation } from "./transactions";

let expensesCache: any[] | null = readFastCache<any[]>("expenses", 30 * 60 * 1000);
let expensesCacheAt = expensesCache ? Date.now() : 0;
let expensesRequest: Promise<any[]> | null = null;
let userRequest: Promise<any> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export function peekExpenses() { return expensesCache; }
export function invalidateExpensesCache() {
  expensesCache = null; expensesCacheAt = 0; expensesRequest = null; clearFastCache("expenses");
}

async function currentUser() {
  if (!userRequest) userRequest = account.get().catch((error) => { userRequest = null; throw error; });
  return userRequest;
}

async function fetchExpenses() {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.expenses,
    queries: [Query.orderAsc("vencimento"), Query.limit(500)] });
  const rows = result.rows.map((x: any) => ({ ...x, id: x.$id, data_vencimento: x.vencimento,
    conta_bancaria_id: x.conta_id, comprovante_url: x.comprovante_id }));
  expensesCache = rows;
  expensesCacheAt = Date.now();
  writeFastCache("expenses", rows);
  return rows;
}

export async function getExpenses(force = false) {
  if (!force && expensesCache && Date.now() - expensesCacheAt < CACHE_TTL) return expensesCache;
  if (!force && expensesRequest) return expensesRequest;
  expensesRequest = fetchExpenses().finally(() => { expensesRequest = null; });
  return expensesRequest;
}

export async function createExpenses(records: Record<string, any>[]) {
  const user = await currentUser();
  const now = new Date().toISOString();
  const result = await Promise.all(records.map((x) => tables.createRow({ databaseId: appwriteConfig.databaseId,
    tableId: TABLES.expenses, rowId: ID.unique(), data: {
      descricao: x.descricao, categoria_id: x.categoria_id || "", categoria: x.categoria || "",
      competencia: new Date(`${x.competencia}T12:00:00`).toISOString(),
      vencimento: new Date(`${x.data_vencimento}T12:00:00`).toISOString(), valor: Number(x.valor),
      conta_id: x.conta_bancaria_id || "", fornecedor: x.fornecedor || "", observacao: x.observacoes || "",
      status: "pendente", recorrente: Boolean(x.recorrente), recorrencia_id: x.recorrencia_id || "",
      data_pagamento: "", comprovante_id: "", created_by: user.$id,
      created_at: now, updated_at: now,
    } })));
  invalidateExpensesCache();
  return result;
}

export async function createExpenseWithOptionalRecurrence(data: Record<string, any>, months: number) {
  let recurrenceId = "";
  if (data.recorrente) {
    const due = new Date(`${data.data_vencimento}T12:00:00`);
    const recurrence = await createRecurrence({ descricao: data.descricao, categoria_id: data.categoria_id || "",
      conta_id: data.conta_bancaria_id || "", valor: Number(data.valor), dia_vencimento: due.getDate(), data_inicio: data.data_vencimento });
    recurrenceId = recurrence.id;
  }
  const records = [];
  for (let i = 0; i < (data.recorrente ? months : 1); i++) {
    const due = new Date(`${data.data_vencimento}T12:00:00`); due.setMonth(due.getMonth() + i);
    records.push({ ...data,
      descricao: data.recorrente ? `${data.descricao} - ${due.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}` : data.descricao,
      data_vencimento: due.toISOString().slice(0, 10), competencia: new Date(due.getFullYear(), due.getMonth(), 1, 12).toISOString().slice(0, 10),
      status: "pendente", recorrencia_id: recurrenceId });
  }
  return createExpenses(records);
}

export async function payExpense(values: Record<string, unknown>) {
  const result = await payExpenseOperation(values); invalidateExpensesCache(); return result;
}
export async function reverseExpensePayment(values: Record<string, unknown>) {
  const result = await reverseExpensePaymentOperation(values); invalidateExpensesCache(); return result;
}
export async function deleteExpenseDirect(expenseId: string) {
  // A UI já bloqueia exclusão de despesa paga. Evitamos um GET extra aqui para a lixeira responder mais rápido.
  await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.expenses, rowId: expenseId });
  if (expensesCache) {
    expensesCache = expensesCache.filter((x: any) => x.id !== expenseId && x.$id !== expenseId);
    expensesCacheAt = Date.now(); writeFastCache("expenses", expensesCache);
  }
}
export async function findActivePayment(expenseId: string) {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.payments,
    queries: [Query.equal("despesa_id", expenseId), Query.equal("estornado", false), Query.limit(1)] });
  return result.rows[0] ? { ...result.rows[0], id: result.rows[0].$id } : null;
}
