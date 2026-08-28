import { ID } from "appwrite";
import { appwriteConfig, storage } from "../lib/appwrite";

const allowed = ["application/pdf", "image/jpeg", "image/png"];
const bankLogoAllowed = ["image/jpeg", "image/png"];

export async function uploadReceipt(file: File) {
  if (!allowed.includes(file.type)) throw new Error("Envie um arquivo PDF, JPG, JPEG ou PNG.");
  const result = await storage.createFile({ bucketId: appwriteConfig.receiptsBucketId, fileId: ID.unique(), file });
  return result.$id;
}

export const getReceiptView = (fileId: string) => storage.getFileView({ bucketId: appwriteConfig.receiptsBucketId, fileId });
export const getReceiptDownload = (fileId: string) => storage.getFileDownload({ bucketId: appwriteConfig.receiptsBucketId, fileId });

const bankLogoId = (accountId: string) => `bank_${accountId}`.slice(0, 36);

export function getBankLogoView(accountId: string) {
  return String(storage.getFileView({ bucketId: appwriteConfig.receiptsBucketId, fileId: bankLogoId(accountId) }));
}

export async function uploadBankLogo(accountId: string, file: File) {
  if (!bankLogoAllowed.includes(file.type)) throw new Error("A logomarca deve estar em PNG, JPG ou JPEG.");
  if (file.size > 2_000_000) throw new Error("A logomarca deve ter no máximo 2 MB.");
  const fileId = bankLogoId(accountId);
  try {
    await storage.deleteFile({ bucketId: appwriteConfig.receiptsBucketId, fileId });
  } catch (error: any) {
    if (error?.code !== 404) throw error;
  }
  await storage.createFile({ bucketId: appwriteConfig.receiptsBucketId, fileId, file });
  return fileId;
}

export async function deleteBankLogo(accountId: string) {
  const fileId = bankLogoId(accountId);
  try {
    await storage.deleteFile({ bucketId: appwriteConfig.receiptsBucketId, fileId });
  } catch (error: any) {
    if (error?.code !== 404) throw error;
  }
}
