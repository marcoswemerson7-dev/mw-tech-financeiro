import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

export type Account = {
  id: string; nome: string; tipo_conta: string; banco?: string; codigo_banco?: string;
  agencia?: string; conta?: string; saldo_inicial: number; saldo_atual: number;
  cor?: string; ativo: boolean;
};

const map = (row: any): Account => ({ ...row, id: row.$id, tipo_conta: row.tipo, conta: row.numero_conta });
let accountsCache: Account[] | null = null;
let accountsCacheAt = 0;
const CACHE_TTL = 2 * 60 * 1000;

export function peekAccounts() {
  return accountsCache;
}

export function invalidateAccountsCache() {
  accountsCache = null;
  accountsCacheAt = 0;
}

async function reconcileBalances(accounts: Account[]) {
  const movements = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.transactions,
    queries: [Query.limit(5000)],
  });

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

  const now = new Date().toISOString();
  const reconciled = await Promise.all(accounts.map(async (account) => {
    const calculated = Number((expected.get(account.id) ?? account.saldo_inicial ?? 0).toFixed(2));
    if (Math.abs(calculated - Number(account.saldo_atual || 0)) > 0.009) {
      await tables.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: TABLES.accounts,
        rowId: account.id,
        data: { saldo_atual: calculated, updated_at: now },
      });
    }
    return { ...account, saldo_atual: calculated };
  }));

  return reconciled;
}

export async function getAccounts(force = false) {
  if (!force && accountsCache && Date.now() - accountsCacheAt < CACHE_TTL) return accountsCache;
  const result = await tables.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId: TABLES.accounts,
    queries: [Query.orderAsc("nome"), Query.limit(200)],
  });
  const rows = result.rows.map(map);
  accountsCache = await reconcileBalances(rows);
  accountsCacheAt = Date.now();
  return accountsCache;
}

export async function saveAccount(data: Partial<Account>, id?: string) {
  const payload = {
    nome: data.nome,
    tipo: data.tipo_conta || "corrente",
    banco: data.banco || "",
    codigo_banco: data.codigo_banco || "",
    agencia: data.agencia || "",
    numero_conta: data.conta || "",
    saldo_inicial: Number(data.saldo_inicial || 0),
    saldo_atual: id ? Number(data.saldo_atual || 0) : Number(data.saldo_inicial || 0),
    cor: data.cor || "#0b2b66",
    ativo: data.ativo ?? true,
    updated_at: new Date().toISOString(),
  };
  const result = id
    ? await tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: id, data: payload })
    : await tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: ID.unique(), data: { ...payload, created_at: new Date().toISOString() } });
  invalidateAccountsCache();
  return result;
}

export async function deleteAccount(id: string) {
  const result = await tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: id });
  invalidateAccountsCache();
  return result;
}
