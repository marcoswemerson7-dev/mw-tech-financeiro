import { Query } from "appwrite";
import { appwriteConfig, functions, tables, TABLES } from "../lib/appwrite";
import { getAccounts, invalidateAccountsCache } from "./accounts";

export type Movement = {
  id: string; tipo: string; data: string; descricao: string; valor: number;
  observacao?: string; created_at: string; conta_id?: string; conta_destino_id?: string;
  categoria_id?: string; comprovante_id?: string; despesa_id?: string; pagamento_id?: string;
  contas_bancarias?: { nome: string } | null; categorias_financeiras?: { nome: string } | null;
};

const movementCache = new Map<number, { at: number; rows: Movement[] }>();
const CACHE_TTL = 2 * 60 * 1000;

export function peekMovements(limit = 100) {
  return movementCache.get(limit)?.rows || null;
}

export function invalidateMovementsCache() {
  movementCache.clear();
}

export function syncMovementCounterpartyCache(oldName: string, newName: string, oldDocument = "", newDocument = "") {
  for (const cached of movementCache.values()) {
    for (const row of cached.rows) {
      if (oldName && row.descricao?.includes(oldName)) row.descricao = row.descricao.split(oldName).join(newName);
      if (oldName && row.observacao?.includes(oldName)) row.observacao = row.observacao.split(oldName).join(newName);
      if (oldDocument && row.observacao?.includes(oldDocument)) row.observacao = row.observacao.split(oldDocument).join(newDocument);
    }
  }
}

export async function getMovements(limit = 100, force = false) {
  const cached = movementCache.get(limit);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.rows;
  const [result, accounts, categories] = await Promise.all([
    tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions,
      queries: [Query.orderDesc("data"), Query.limit(limit)] }),
    getAccounts(),
    tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.categories, queries: [Query.limit(200)] }),
  ]);
  const rows = result.rows.map((row: any) => ({ ...row, id: row.$id,
    contas_bancarias: accounts.find((x) => x.id === row.conta_id) ? { nome: accounts.find((x) => x.id === row.conta_id)!.nome } : null,
    categorias_financeiras: categories.rows.find((x: any) => x.$id === row.categoria_id) ? { nome: (categories.rows.find((x: any) => x.$id === row.categoria_id) as any).nome } : null,
  })) as Movement[];
  movementCache.set(limit, { at: Date.now(), rows });
  return rows;
}

async function execute(action: string, payload: Record<string, unknown>) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Configure VITE_APPWRITE_FINANCIAL_FUNCTION_ID para executar operações financeiras.");
  const execution = await functions.createExecution({ functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }), async: false });
  const body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  if (execution.status !== "completed" || body.error) throw new Error(body.error || "Operação financeira não concluída.");
  invalidateMovementsCache();
  invalidateAccountsCache();
  return body;
}

export const registerMovement = (values: Record<string, unknown>) => execute(values.tipo === "transferencia" ? "transfer" : "registerMovement", values);
export const updateMovement = (id: string, values: Record<string, unknown>) => execute("updateMovement", { movimentacao_id: id, ...values });

function addEffect(effects: Map<string, number>, accountId: string | undefined, delta: number) {
  if (!accountId) return;
  effects.set(accountId, (effects.get(accountId) || 0) + delta);
}

function movementEffect(move: any, effects: Map<string, number>) {
  const value = Number(move.valor);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Valor inválido na movimentação.");
  if (move.tipo === "transferencia") {
    addEffect(effects, move.conta_id, -value);
    addEffect(effects, move.conta_destino_id, value);
  } else if (move.tipo === "saida") {
    addEffect(effects, move.conta_id, -value);
  } else {
    addEffect(effects, move.conta_id, value);
  }
}

async function cleanupLinkedMovement(move: any) {
  const expenseId = String(move.despesa_id || "");
  if (!expenseId) throw new Error("Movimentação vinculada sem despesa identificada.");

  let expense: any = null;
  try {
    expense = await tables.getRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.expenses, rowId: expenseId });
  } catch (error: any) {
    if (error?.code !== 404) throw error;
  }

  if (expense?.status === "pago") {
    throw new Error("Estorne o pagamento da despesa antes de excluir estes registros.");
  }

  const [movementResult, paymentResult] = await Promise.all([
    tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions,
      queries: [Query.equal("despesa_id", expenseId), Query.limit(200)] }),
    tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.payments,
      queries: [Query.equal("despesa_id", expenseId), Query.limit(200)] }),
  ]);

  const linkedMovements = movementResult.rows as any[];
  const linkedPayments = paymentResult.rows as any[];
  if (linkedPayments.some((payment) => !payment.estornado)) {
    throw new Error("Existe pagamento ativo nesta despesa. Estorne o pagamento antes de excluir definitivamente.");
  }

  const effects = new Map<string, number>();
  linkedMovements.forEach((linked) => movementEffect(linked, effects));

  const accountSnapshots = new Map<string, number>();
  const now = new Date().toISOString();
  for (const [accountId, effect] of effects.entries()) {
    const account: any = await tables.getRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: accountId });
    const current = Number(account.saldo_atual || 0);
    const next = current - effect;
    if (next < 0) throw new Error("Não é possível excluir porque o saldo atual não permite desfazer todo o histórico vinculado.");
    accountSnapshots.set(accountId, current);
    await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: accountId,
      data: { saldo_atual: next, updated_at: now } });
  }

  try {
    for (const linked of linkedMovements) {
      await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions, rowId: linked.$id });
    }
    for (const payment of linkedPayments) {
      await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.payments, rowId: payment.$id });
    }
    if (expense) {
      await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.expenses, rowId: expense.$id });
    }
  } catch (error) {
    for (const [accountId, balance] of accountSnapshots.entries()) {
      await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: accountId,
        data: { saldo_atual: balance, updated_at: now } }).catch(() => undefined);
    }
    throw error;
  }
}

export async function deleteMovement(id: string) {
  const move: any = await tables.getRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions, rowId: id });

  if (move.despesa_id || move.pagamento_id) {
    await cleanupLinkedMovement(move);
    invalidateMovementsCache();
    invalidateAccountsCache();
    return;
  }

  const value = Number(move.valor);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Valor inválido na movimentação.");

  const origin: any = await tables.getRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: move.conta_id });
  const originBalance = Number(origin.saldo_atual || 0);
  const transfer = move.tipo === "transferencia";
  const out = move.tipo === "saida" || transfer;
  const revertedOrigin = originBalance + (out ? value : -value);
  if (revertedOrigin < 0) {
    throw new Error("Não é possível excluir esta movimentação porque o saldo atual não permite desfazer seu efeito.");
  }

  let destination: any = null;
  let revertedDestination = 0;
  if (transfer) {
    if (!move.conta_destino_id) throw new Error("Transferência sem conta de destino vinculada.");
    destination = await tables.getRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: move.conta_destino_id });
    revertedDestination = Number(destination.saldo_atual || 0) - value;
    if (revertedDestination < 0) {
      throw new Error("Não é possível excluir esta transferência porque a conta de destino não possui saldo suficiente para desfazer a operação.");
    }
  }

  const now = new Date().toISOString();
  await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: origin.$id,
    data: { saldo_atual: revertedOrigin, updated_at: now } });

  try {
    if (destination) {
      await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: destination.$id,
        data: { saldo_atual: revertedDestination, updated_at: now } });
    }
    await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions, rowId: id });
  } catch (error) {
    await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: origin.$id,
      data: { saldo_atual: originBalance, updated_at: now } }).catch(() => undefined);
    if (destination) {
      await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: destination.$id,
        data: { saldo_atual: Number(destination.saldo_atual || 0), updated_at: now } }).catch(() => undefined);
    }
    throw error;
  }

  invalidateMovementsCache();
  invalidateAccountsCache();
}

export const updateExpense = (id: string, values: Record<string, unknown>) => execute("updateExpense", { despesa_id: id, ...values });
export const cancelExpense = (id: string) => execute("cancelExpense", { despesa_id: id });
export const deleteExpense = (id: string) => execute("deleteExpense", { despesa_id: id });
export const hardDeleteExpense = (id: string) => execute("hardDeleteExpense", { despesa_id: id });
export const payExpense = (values: Record<string, unknown>) => execute("payExpense", values);
export const reverseExpensePayment = (values: Record<string, unknown>) => execute("reverseExpensePayment", values);
