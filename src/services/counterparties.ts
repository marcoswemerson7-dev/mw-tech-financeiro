import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

export type Counterparty = {
  id: string;
  nome: string;
  tipo: "cliente" | "fornecedor" | "orgao_publico" | "outro";
  documento?: string;
  observacao?: string;
  ativo: boolean;
};

export async function getCounterparties() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries: [Query.equal("ativo", true), Query.orderAsc("nome"), Query.limit(500)],
  });
  return result.rows.map((row: any) => ({ ...row, id: row.$id })) as Counterparty[];
}

export async function saveCounterparty(values: {
  id?: string;
  nome: string;
  tipo: Counterparty["tipo"];
  documento?: string;
  observacao?: string;
  ativo?: boolean;
}) {
  const data = {
    nome: values.nome.trim(),
    tipo: values.tipo,
    documento: values.documento?.trim() || "",
    observacao: values.observacao?.trim() || "",
    ativo: values.ativo ?? true,
  };
  const row = values.id
    ? await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.counterparties,
        rowId: values.id,
        data,
      })
    : await tables.createRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.counterparties,
        rowId: ID.unique(),
        data: { ...data, created_at: new Date().toISOString() },
      });
  return { ...row, id: row.$id } as unknown as Counterparty;
}

export async function createCounterparty(values: {
  nome: string;
  tipo: Counterparty["tipo"];
  documento?: string;
  observacao?: string;
}) {
  return saveCounterparty(values);
}

export async function deactivateCounterparty(id: string) {
  return tables.updateRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    rowId: id,
    data: { ativo: false },
  });
}
