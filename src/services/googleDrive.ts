import { appwriteConfig, functions } from "../lib/appwrite";

export type DriveFolderUsage = {
  id: string;
  name: string;
  bytes: number;
  usedGb: number;
  files: number;
  folders: number;
  percentOfTotal: number;
};

export type DriveStorageUsage = {
  totalGb: number;
  usedGb: number;
  availableGb: number;
  percent: number;
  folders: DriveFolderUsage[];
  updatedAt: string;
};

export async function getDriveStorageUsage(): Promise<DriveStorageUsage> {
  if (!appwriteConfig.financialFunctionId) {
    throw new Error("Função administrativa não configurada.");
  }

  const execution = await functions.createExecution({
    functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action: "getDriveStorage" }),
    async: false,
  });
  const body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  if (execution.status !== "completed" || body.error) {
    throw new Error(body.error || "Não foi possível consultar o armazenamento.");
  }
  return body as DriveStorageUsage;
}
