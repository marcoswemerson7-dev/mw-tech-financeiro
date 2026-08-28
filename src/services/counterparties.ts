import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";
import { syncMovementCounterpartyCache } from "./transactions";

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

async function syncCounterpartyReferences(before: Counterparty, after: Counterparty) {
  const oldName = String(before.nome || "").trim();
  const newName = String(after.nome || "").trim();
  const oldDocument = String(before.documento || "").trim();
  const newDocument = String(after.documento || "").trim();

  if (!oldName || (oldName === newName && oldDocument === newDocument)) return;

  const [movementResult, expenseResult] = await Promise.all([
    tables.listRows({
      databaseId: appwriteConfig.databaseId,
      tableId: TABLES.transactions,
      queries: [Query.limit(500)],
    }),
    tables.listRows({
      databaseId: appwriteConfig.databaseId,
      tableId: TABLES.expenses,
      queries: [Query.limit(500)],
    }),
  ]);

  await Promise.all(
    movementResult.rows.map(async (row: any) => {
      const description = String(row.descricao || "");
      const note = String(row.observacao || "");
      const linkedById = note.includes(`Parte financeira ID: ${before.id}`);
      const linkedByName = description.includes(oldName) || note.includes(oldName);
      if (!linkedById && !linkedByName) return;

      let nextDescription = description;
      let nextNote = note;
      if (oldName !== newName) {
        nextDescription = nextDescription.split(oldName).join(newName);
        nextNote = nextNote.split(oldName).join(newName);
      }
      if (oldDocument && oldDocument !== newDocument) {
        nextNote = nextNote.split(oldDocument).join(newDocument);
      }

      await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.transactions,
        rowId: row.$id,
        data: { descricao: nextDescription, observacao: nextNote },
      });
    }),
  );

  await Promise.all(
    expenseResult.rows.map(async (row: any) => {
      const supplier = String(row.fornecedor || "").trim();
      if (!supplier || supplier !== oldName) return;
      await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.expenses,
        rowId: row.$id,
        data: { fornecedor: newName },
      });
    }),
  );

  syncMovementCounterpartyCache(oldName, newName, oldDocument, newDocument);
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

  let before: Counterparty | null = null;
  if (values.id) {
    const current = await tables.getRow({
      databaseId: appwriteConfig.databaseId,
      tableId: TABLES.counterparties,
      rowId: values.id,
    });
    before = map(current);
  }

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

  const saved = map(row);
  if (before) await syncCounterpartyReferences(before, saved);
  return saved;
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
