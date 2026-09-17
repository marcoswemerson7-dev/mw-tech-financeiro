import { ID } from "appwrite";
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
    body: JSON.stringify({
      action: "getDriveStorage",
      idempotencyKey: `drive-storage-${ID.unique()}`,
    }),
    async: false,
  });

  let body: Record<string, unknown> = {};
  try {
    body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  } catch {
    body = {};
  }

  if (execution.status !== "completed" || body.error) {
    const executionError = String((execution as unknown as { errors?: string }).errors || "").trim();
    const responseError = typeof body.error === "string" ? body.error : "";
    throw new Error(responseError || executionError || `Falha na função do Google Drive (${execution.status}).`);
  }

  return body as unknown as DriveStorageUsage;
}
