import { ID, Query } from "appwrite";
import { appwriteConfig, functions, tables, TABLES } from "../lib/appwrite";

export type Recurrence = {
  id: string;
  descricao: string;
  categoria_id?: string;
  conta_id?: string;
  valor: number;
  dia_vencimento: number;
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
  created_at: string;
};

export async function getRecurrences() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.recurrences,
    queries: [Query.orderDesc("created_at"), Query.limit(200)],
  });
  return result.rows.map((row: any) => ({ ...row, id: row.$id })) as Recurrence[];
}

export async function createRecurrence(values: {
  descricao: string;
  categoria_id?: string;
  conta_id?: string;
  valor: number;
  dia_vencimento: number;
  data_inicio: string;
  data_fim?: string;
}) {
  const row = await tables.createRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.recurrences,
    rowId: ID.unique(),
    data: {
      descricao: values.descricao.trim(),
      categoria_id: values.categoria_id || "",
      conta_id: values.conta_id || "",
      valor: Number(values.valor),
      dia_vencimento: Number(values.dia_vencimento),
      data_inicio: new Date(`${values.data_inicio}T12:00:00`).toISOString(),
      data_fim: values.data_fim ? new Date(`${values.data_fim}T12:00:00`).toISOString() : "",
      ativo: true,
      created_at: new Date().toISOString(),
    },
  });
  return { ...row, id: row.$id } as unknown as Recurrence;
}

export async function setRecurrenceActive(id: string, ativo: boolean) {
  return tables.updateRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.recurrences,
    rowId: id,
    data: { ativo },
  });
}

export async function updateRecurrence(id: string, values: Partial<Pick<Recurrence, "descricao" | "valor" | "dia_vencimento" | "data_inicio" | "data_fim">>) {
  return tables.updateRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.recurrences,
    rowId: id,
    data: {
      ...(values.descricao === undefined ? {} : { descricao: values.descricao.trim() }),
      ...(values.valor === undefined ? {} : { valor: Number(values.valor) }),
      ...(values.dia_vencimento === undefined ? {} : { dia_vencimento: Number(values.dia_vencimento) }),
      ...(values.data_inicio === undefined ? {} : { data_inicio: new Date(`${values.data_inicio}T12:00:00`).toISOString() }),
      ...(values.data_fim === undefined ? {} : { data_fim: values.data_fim ? new Date(`${values.data_fim}T12:00:00`).toISOString() : "" }),
    },
  });
}

export async function deleteRecurrence(id: string) {
  return tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.recurrences, rowId: id });
}

export async function generateRecurringExpenses() {
  if (!appwriteConfig.recurringFunctionId) {
    throw new Error("Configure VITE_APPWRITE_RECURRING_FUNCTION_ID para gerar recorrências.");
  }
  const execution = await functions.createExecution({
    functionId: appwriteConfig.recurringFunctionId,
    body: JSON.stringify({}),
    async: false,
  });
  const body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  if (execution.status !== "completed" || body.error) {
    throw new Error(body.error || "Não foi possível gerar recorrências.");
  }
  return body as { ok: boolean; created: string[] };
}
