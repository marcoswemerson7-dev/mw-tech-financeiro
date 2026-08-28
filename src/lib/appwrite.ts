import { Account, Client, Functions, Storage, TablesDB } from "appwrite";

export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || "",
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || "",
  receiptsBucketId: import.meta.env.VITE_APPWRITE_COMPROVANTES_BUCKET_ID || "comprovantes",
  financialFunctionId: import.meta.env.VITE_APPWRITE_FINANCIAL_FUNCTION_ID || "financial-operations",
};

export const isAppwriteConfigured = Boolean(
  appwriteConfig.endpoint && appwriteConfig.projectId && appwriteConfig.databaseId,
);

export const appwriteClient = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId || "not-configured");

export const account = new Account(appwriteClient);
export const tables = new TablesDB(appwriteClient);
export const storage = new Storage(appwriteClient);
export const functions = new Functions(appwriteClient);

export const TABLES = {
  profiles: "profiles",
  accounts: "contas_financeiras",
  categories: "categorias_financeiras",
  transactions: "movimentacoes_financeiras",
  expenses: "despesas",
  recurrences: "despesas_recorrencias",
  payments: "pagamentos_despesas",
  company: "configuracoes_empresa",
} as const;
