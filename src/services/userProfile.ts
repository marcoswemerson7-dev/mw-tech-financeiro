import { ID } from "appwrite";
import { account, appwriteConfig, storage } from "../lib/appwrite";

export type UserProfilePrefs = {
  cargo?: string;
  telefone?: string;
  avatar_url?: string;
};

export async function updateUserProfile(values: { name: string; cargo: string; telefone?: string; avatarFile?: File | null }) {
  const current = await account.get();
  const prefs = (current.prefs || {}) as UserProfilePrefs;
  let avatarUrl = String(prefs.avatar_url || "");

  if (values.avatarFile) {
    if (!values.avatarFile.type.startsWith("image/")) throw new Error("Selecione uma imagem válida para o perfil.");
    if (values.avatarFile.size > 4 * 1024 * 1024) throw new Error("A foto de perfil deve ter no máximo 4 MB.");
    try {
      const uploaded = await storage.createFile({
        bucketId: appwriteConfig.receiptsBucketId,
        fileId: ID.unique(),
        file: values.avatarFile,
      });
      avatarUrl = storage.getFileView({
        bucketId: appwriteConfig.receiptsBucketId,
        fileId: uploaded.$id,
      }).toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no upload da foto.";
      throw new Error(`Não foi possível enviar a foto do perfil: ${message}`);
    }
  }

  const name = values.name.trim();
  if (!name) throw new Error("Informe o nome do usuário.");

  await account.updateName({ name });
  await account.updatePrefs({
    prefs: {
      ...(current.prefs || {}),
      cargo: values.cargo.trim() || "Colaborador",
      telefone: String(values.telefone || "").trim(),
      avatar_url: avatarUrl,
    },
  });
  return account.get();
}

export async function changeUserPassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  if (!currentPassword) throw new Error("Informe sua senha atual.");
  if (!newPassword) throw new Error("Informe a nova senha.");
  if (newPassword.length < 8) throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
  if (newPassword !== confirmPassword) throw new Error("A confirmação da nova senha não confere.");
  await account.updatePassword({ password: newPassword, oldPassword: currentPassword });
}
