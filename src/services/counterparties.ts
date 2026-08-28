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

function map(row: any) {
  return { ...row, id: row.$id } as Counterparty;
}

export async function getCounterparties(includeInactive = false) {
  const queries = [Query.orderAsc("nome"), Query.limit(500)];
  if (!includeInactive) queries.unshift(Query.equal("ativo", true));
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries,
  });
  return result.rows.map(map);
}

export async function saveCounterparty(values: CounterpartyInput) {
  const nome = values.nome?.trim();
  if (!nome) throw new Error("Informe o nome ou razão social.");
  const allowed: Counterparty["tipo"][] = ["cliente", "fornecedor", "orgao_publico", "outro"];
  if (!allowed.includes(values.tipo)) throw new Error("Tipo de cadastro inválido.");

  const data = {
    nome,
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
  return map(row);
}

export async function createCounterparty(values: CounterpartyInput | Record<string, unknown>) {
  return saveCounterparty({
    id: values.id ? String(values.id) : undefined,
    nome: String(values.nome || "").trim(),
    tipo: String(values.tipo || "") as Counterparty["tipo"],
    documento: String(values.documento || "").trim(),
    observacao: String(values.observacao || "").trim(),
    ativo: values.ativo === undefined ? true : Boolean(values.ativo),
  });
}

export async function updateCounterparty(id: string, values: Record<string, unknown>) {
  const current = await tables.getRow({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    rowId: id,
  });
  return saveCounterparty({
    id,
    nome: String(values.nome ?? (current as any).nome ?? ""),
    tipo: String(values.tipo ?? (current as any).tipo ?? "outro") as Counterparty["tipo"],
    documento: String(values.documento ?? (current as any).documento ?? ""),
    observacao: String(values.observacao ?? (current as any).observacao ?? ""),
    ativo: values.ativo === undefined ? Boolean((current as any).ativo) : Boolean(values.ativo),
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
