import { Query } from "appwrite";
import { appwriteConfig, functions, tables, TABLES } from "../lib/appwrite";
import { clearFastCache, readFastCache, writeFastCache } from "../lib/fast-cache";

export type Account = {
  id: string; nome: string; tipo_conta: string; banco?: string; codigo_banco?: string;
  agencia?: string; conta?: string; saldo_inicial: number; saldo_atual: number;
  cor?: string; ativo: boolean;
  logo_url?: string;
};

const map = (row: any): Account => ({ ...row, id: row.$id, tipo_conta: row.tipo, conta: row.numero_conta });
let accountsCache: Account[] | null = readFastCache<Account[]>("accounts", 30 * 60 * 1000);
let accountsCacheAt = accountsCache ? Date.now() : 0;
const CACHE_TTL = 5 * 60 * 1000;
let reconcilePromise: Promise<Account[]> | null = null;

export function peekAccounts() { return accountsCache; }
export function invalidateAccountsCache() { accountsCache = null; accountsCacheAt = 0; clearFastCache("accounts"); }

async function execute(action: string, payload: Record<string, unknown>) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Função financeira não configurada.");
  const execution = await functions.createExecution({
    functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }),
    async: false,
  });
  let body: Record<string, any> = {};
  try { body = execution.responseBody ? JSON.parse(execution.responseBody) : {}; } catch { body = {}; }
  const executionError = String((execution as unknown as { errors?: string }).errors || "").trim();
  if (execution.status !== "completed" || body.error) throw new Error(body.error || executionError || "Operação não concluída.");
  return body;
}

async function reconcileBalances(accounts: Account[]) {
  const movements = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.transactions, queries: [Query.limit(5000)] });
  const expected = new Map(accounts.map((account) => [account.id, Number(account.saldo_inicial || 0)]));
  for (const movement of movements.rows as any[]) {
    const value = Number(movement.valor || 0);
    if (!Number.isFinite(value) || value === 0) continue;
    const originId = String(movement.conta_id || "");
    if (originId && expected.has(originId)) {
      const current = expected.get(originId) || 0;
      const isOut = movement.tipo === "saida" || movement.tipo === "transferencia";
      expected.set(originId, current + (isOut ? -value : value));
    }
    if (movement.tipo === "transferencia" && movement.conta_destino_id && expected.has(String(movement.conta_destino_id))) {
      const destinationId = String(movement.conta_destino_id);
      expected.set(destinationId, (expected.get(destinationId) || 0) + value);
    }
  }
  const reconciled = accounts.map((account) => ({ ...account, saldo_atual: Number((expected.get(account.id) ?? account.saldo_inicial ?? 0).toFixed(2)) }));
  accountsCache = reconciled; accountsCacheAt = Date.now(); writeFastCache("accounts", reconciled); return reconciled;
}

export function reconcileAccountsInBackground() {
  if (!accountsCache || reconcilePromise) return reconcilePromise;
  reconcilePromise = reconcileBalances(accountsCache).finally(() => { reconcilePromise = null; });
  return reconcilePromise;
}

export async function getAccounts(force = false) {
  if (!force && accountsCache && Date.now() - accountsCacheAt < CACHE_TTL) return accountsCache;
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, queries: [Query.orderAsc("nome"), Query.limit(200)] });
  const rows = result.rows.map(map);
  accountsCache = rows; accountsCacheAt = Date.now(); writeFastCache("accounts", rows);
  return rows;
}

export async function saveAccount(data: Partial<Account>, id?: string) {
  const payload = {
    id,
    nome: data.nome,
    tipo_conta: data.tipo_conta || "corrente",
    banco: data.banco || "",
    codigo_banco: data.codigo_banco || "",
    agencia: data.agencia || "",
    conta: data.conta || "",
    saldo_inicial: Number(data.saldo_inicial || 0),
    saldo_atual: Number(data.saldo_atual ?? data.saldo_inicial ?? 0),
    cor: data.cor || "#0b2b66",
    ativo: data.ativo ?? true,
  };
  const result = await execute("saveAccount", payload);
  invalidateAccountsCache();
  return result.row;
}

export async function deleteAccount(id: string) {
  const result = await execute("deleteAccount", { id });
  invalidateAccountsCache();
  return result;
}
