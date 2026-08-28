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

let legacyReconciliation: Promise<void> | null = null;

function map(row: any) {
  return { ...row, id: row.$id } as Counterparty;
}

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function replaceMovementParty(description: string, newName: string) {
  const separator = " — ";
  const index = description.indexOf(separator);
  if (index < 0) return description;
  const prefix = description.slice(0, index);
  if (/^Recebido de /i.test(prefix)) return `Recebido de ${newName}${description.slice(index)}`;
  if (/^Pago para /i.test(prefix)) return `Pago para ${newName}${description.slice(index)}`;
  return description;
}

async function reconcileLegacyReferences(parties: Counterparty[]) {
  const byDocument = new Map(
    parties
      .map((party) => [onlyDigits(party.documento), party] as const)
      .filter(([document]) => document.length >= 8),
  );
  if (!byDocument.size) return;

  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.transactions,
    queries: [Query.limit(500)],
  });

  await Promise.all(
    result.rows.map(async (row: any) => {
      const note = String(row.observacao || "");
      const description = String(row.descricao || "");
      const noteDigits = onlyDigits(note);
      const party = [...byDocument.entries()].find(([document]) => noteDigits.includes(document))?.[1];
      if (!party) return;

      const currentDescription = replaceMovementParty(description, party.nome);
      let currentNote = note;
      const firstLineEnd = currentNote.indexOf("\n");
      const suffix = firstLineEnd >= 0 ? currentNote.slice(firstLineEnd) : "";
      currentNote = `Parte financeira ID: ${party.id}\nParte financeira: ${party.nome}${party.documento ? ` (${party.documento})` : ""}${suffix}`;

      if (currentDescription === description && currentNote === note) return;
      await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.transactions,
        rowId: row.$id,
        data: { descricao: currentDescription, observacao: currentNote },
      });
    }),
  );
}

export async function getCounterparties(includeInactive = false) {
  const queries = [Query.orderAsc("nome"), Query.limit(500)];
  if (!includeInactive) queries.unshift(Query.equal("ativo", true));
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.counterparties,
    queries,
  });
  const rows = result.rows.map(map);

  if (!legacyReconciliation) {
    legacyReconciliation = reconcileLegacyReferences(rows).catch((error) => {
      console.warn("Não foi possível reconciliar referências antigas de cadastros.", error);
    });
  }
  await legacyReconciliation;
  return rows;
}

async function syncCounterpartyReferences(before: Counterparty, after: Counterparty) {
  const oldName = String(before.nome || "").trim();
  const newName = String(after.nome || "").trim();
  const oldDocument = String(before.documento || "").trim();
  const newDocument = String(after.documento || "").trim();

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

  const oldDigits = onlyDigits(oldDocument);
  await Promise.all(
    movementResult.rows.map(async (row: any) => {
      const description = String(row.descricao || "");
      const note = String(row.observacao || "");
      const linkedById = note.includes(`Parte financeira ID: ${before.id}`);
      const linkedByDocument = oldDigits.length >= 8 && onlyDigits(note).includes(oldDigits);
      const linkedByName = Boolean(oldName) && (description.includes(oldName) || note.includes(oldName));
      if (!linkedById && !linkedByDocument && !linkedByName) return;

      let nextDescription = description;
      let nextNote = note;
      if (oldName && oldName !== newName) {
        nextDescription = nextDescription.split(oldName).join(newName);
        nextNote = nextNote.split(oldName).join(newName);
      }
      nextDescription = replaceMovementParty(nextDescription, newName);

      if (oldDocument && oldDocument !== newDocument) {
        nextNote = nextNote.split(oldDocument).join(newDocument);
      }
      if (!nextNote.includes(`Parte financeira ID: ${after.id}`)) {
        nextNote = `Parte financeira ID: ${after.id}\n${nextNote}`;
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
      if (!supplier || (supplier !== oldName && supplier !== newName)) return;
      await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.expenses,
        rowId: row.$id,
        data: { fornecedor: newName },
      });
    }),
  );

  syncMovementCounterpartyCache(oldName, newName, oldDocument, newDocument);
  legacyReconciliation = null;
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
