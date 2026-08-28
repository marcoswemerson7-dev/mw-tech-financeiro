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

export async function createCounterparty(values: {
  nome: string;
  tipo: Counterparty["tipo"];
  documento?: string;
  observacao?: string;
}) {
  const row = await tables.createRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    rowId: ID.unique(),
    data: {
      nome: values.nome.trim(),
      tipo: values.tipo,
      documento: values.documento?.trim() || "",
      observacao: values.observacao?.trim() || "",
      ativo: true,
      created_at: new Date().toISOString(),
    },
  });
  return { ...row, id: row.$id } as Counterparty;
}
