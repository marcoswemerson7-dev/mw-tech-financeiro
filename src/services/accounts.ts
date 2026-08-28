import { ID, Query } from "appwrite";
import { appwriteConfig, tables, TABLES } from "../lib/appwrite";

export type Account = {
  id: string; nome: string; tipo_conta: string; banco?: string; codigo_banco?: string;
  agencia?: string; conta?: string; saldo_inicial: number; saldo_atual: number;
  cor?: string; ativo: boolean;
};

const map = (row: any): Account => ({ ...row, id: row.$id, tipo_conta: row.tipo, conta: row.numero_conta });
export async function getAccounts() {
  const result = await tables.listRows({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts,
    queries: [Query.orderAsc("nome"), Query.limit(200)] });
  return result.rows.map(map);
}
export async function saveAccount(data: Partial<Account>, id?: string) {
  const payload = {
    nome: data.nome, tipo: data.tipo_conta || "corrente", banco: data.banco || "",
    codigo_banco: data.codigo_banco || "", agencia: data.agencia || "",
    numero_conta: data.conta || "", saldo_inicial: Number(data.saldo_inicial || 0),
    saldo_atual: id ? Number(data.saldo_atual || 0) : Number(data.saldo_inicial || 0),
    cor: data.cor || "#0b2b66", ativo: data.ativo ?? true,
    updated_at: new Date().toISOString(),
  };
  return id
    ? tables.updateRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: id, data: payload })
    : tables.createRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: ID.unique(), data: { ...payload, created_at: new Date().toISOString() } });
}
export const deleteAccount = (id: string) => tables.deleteRow({ databaseId: appwriteConfig.databaseId, tableId: TABLES.accounts, rowId: id });
