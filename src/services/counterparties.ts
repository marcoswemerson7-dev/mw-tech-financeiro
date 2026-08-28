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

type CounterpartyInput = {
  id?: string;
  nome: string;
  tipo: Counterparty["tipo"];
  documento?: string;
  observacao?: string;
  ativo?: boolean;
};

export async function getCounterparties() {
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries: [Query.equal("ativo", true), Query.orderAsc("nome"), Query.limit(500)],
  });
  return result.rows.map((row: any) => ({ ...row, id: row.$id })) as Counterparty[];
}

export async function saveCounterparty(values: CounterpartyInput) {
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

export async function createCounterparty(values: CounterpartyInput | Record<string, unknown>) {
  const nome = String(values.nome || "").trim();
  const tipo = String(values.tipo || "") as Counterparty["tipo"];
  const allowed: Counterparty["tipo"][] = ["cliente", "fornecedor", "orgao_publico", "outro"];

  if (!nome) throw new Error("Informe o nome ou razão social.");
  if (!allowed.includes(tipo)) throw new Error("Tipo de cadastro inválido.");

  return saveCounterparty({
    nome,
    tipo,
    documento: String(values.documento || "").trim(),
    observacao: String(values.observacao || "").trim(),
  });
}

export async function deactivateCounterparty(id: string) {
  return tables.updateRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    rowId: id,
    data: { ativo: false },
  });
}
