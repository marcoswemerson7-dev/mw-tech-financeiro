import { ID, Query } from "appwrite";
import { account, appwriteConfig, tables, TABLES } from "../lib/appwrite";
import { createRecurrence } from "./recurrences";
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
      competencia: new Date(`${x.competencia}T12:00:00`).toISOString(),
      vencimento: new Date(`${x.data_vencimento}T12:00:00`).toISOString(),
      valor: Number(x.valor),
      conta_id: x.conta_bancaria_id || "", fornecedor: x.fornecedor || "", observacao: x.observacoes || "",
      status: "pendente", recorrente: Boolean(x.recorrente), recorrencia_id: x.recorrencia_id || "",
      data_pagamento: "", comprovante_id: "", created_by: user.$id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } }))); 
}
export async function createExpenseWithOptionalRecurrence(data: Record<string, any>, months: number) {
  let recurrenceId = "";
  if (data.recorrente) {
    const due = new Date(`${data.data_vencimento}T12:00:00`);
    const recurrence = await createRecurrence({
      descricao: data.descricao,
      categoria_id: data.categoria_id || "",
      conta_id: data.conta_bancaria_id || "",
      valor: Number(data.valor),
      dia_vencimento: due.getDate(),
      data_inicio: data.data_vencimento,
    });
    recurrenceId = recurrence.id;
  }
  const records = [];
  for (let i = 0; i < (data.recorrente ? months : 1); i++) {
    const due = new Date(`${data.data_vencimento}T12:00:00`);
    due.setMonth(due.getMonth() + i);
    records.push({
      ...data,
      descricao: data.recorrente
        ? `${data.descricao} - ${due.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
        : data.descricao,
      data_vencimento: due.toISOString().slice(0, 10),
      competencia: new Date(due.getFullYear(), due.getMonth(), 1, 12).toISOString().slice(0, 10),
      status: "pendente",
      recorrencia_id: recurrenceId,
    });
  }
  return createExpenses(records);
}
export { payExpense, reverseExpensePayment };
export async function findActivePayment(expenseId: string) {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.payments,
    queries: [Query.equal("despesa_id", expenseId), Query.equal("estornado", false), Query.limit(1)] });
  return result.rows[0] ? { ...result.rows[0], id: result.rows[0].$id } : null;
}
