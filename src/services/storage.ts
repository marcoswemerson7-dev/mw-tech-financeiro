import { ID } from "appwrite";
import { appwriteConfig, storage } from "../lib/appwrite";

const allowed = ["application/pdf", "image/jpeg", "image/png"];
export async function uploadReceipt(file: File) {
  if (!allowed.includes(file.type)) throw new Error("Envie um arquivo PDF, JPG, JPEG ou PNG.");
  const result = await storage.createFile({ bucketId: appwriteConfig.receiptsBucketId, fileId: ID.unique(), file });
  return result.$id;
}
export const getReceiptView = (fileId: string) => storage.getFileView({ bucketId: appwriteConfig.receiptsBucketId, fileId });
export const getReceiptDownload = (fileId: string) => storage.getFileDownload({ bucketId: appwriteConfig.receiptsBucketId, fileId });
