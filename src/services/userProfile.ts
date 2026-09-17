import { ID } from "appwrite";
import { account, appwriteConfig, storage } from "../lib/appwrite";

export type UserProfilePrefs = {
  cargo?: string;
  avatar_url?: string;
};

export async function updateUserProfile(values: { name: string; cargo: string; avatarFile?: File | null }) {
  const current = await account.get();
  let avatarUrl = String((current.prefs as UserProfilePrefs)?.avatar_url || "");

  if (values.avatarFile) {
    if (!values.avatarFile.type.startsWith("image/")) throw new Error("Selecione uma imagem válida para o perfil.");
    if (values.avatarFile.size > 4 * 1024 * 1024) throw new Error("A foto de perfil deve ter no máximo 4 MB.");
    const uploaded = await storage.createFile({
      bucketId: appwriteConfig.receiptsBucketId,
      fileId: ID.unique(),
      file: values.avatarFile,
    });
    avatarUrl = storage.getFileView({
      bucketId: appwriteConfig.receiptsBucketId,
      fileId: uploaded.$id,
    }).toString();
  }

  const name = values.name.trim();
  if (!name) throw new Error("Informe o nome do usuário.");
  await account.updateName({ name });
  await account.updatePrefs({
    prefs: {
      ...(current.prefs || {}),
      cargo: values.cargo.trim() || "Colaborador",
      avatar_url: avatarUrl,
    },
  });
  return account.get();
}
