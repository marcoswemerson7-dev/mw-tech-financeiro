import { ID, Query } from "appwrite";
import { account, appwriteConfig, tables, TABLES } from "../lib/appwrite";
import { payExpense, reverseExpensePayment } from "./transactions";

export async function getExpenses() {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.expenses,
    queries: [Query.orderAsc("vencimento"), Query.limit(500)] });
  return result.rows.map((x: any) => ({ ...x, id: x.$id, data_vencimento: x.vencimento,
    conta_bancaria_id: x.conta_id, comprovante_url: x.comprovante_id }));
}
export async function createExpenses(records: Record<string, any>[]) {
  const user = await account.get();
  return Promise.all(records.map((x) => tables.createRow({ databaseId: appwriteConfig.databaseId,
    tableId: TABLES.expenses, rowId: ID.unique(), data: {
      descricao: x.descricao, categoria_id: x.categoria_id || "", categoria: x.categoria || "",
      competencia: x.competencia, vencimento: x.data_vencimento, valor: Number(x.valor),
      conta_id: x.conta_bancaria_id || "", fornecedor: x.fornecedor || "", observacao: x.observacoes || "",
      status: "pendente", recorrente: Boolean(x.recorrente), recorrencia_id: x.recorrencia_id || "",
      data_pagamento: "", comprovante_id: "", created_by: user.$id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } }))); 
}
export { payExpense, reverseExpensePayment };
export async function findActivePayment(expenseId: string) {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.payments,
    queries: [Query.equal("despesa_id", expenseId), Query.equal("estornado", false), Query.limit(1)] });
  return result.rows[0] ? { ...result.rows[0], id: result.rows[0].$id } : null;
}
