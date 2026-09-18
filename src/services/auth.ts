import { account } from "../lib/appwrite";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

async function resolveEmail(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();

  const cpf = onlyDigits(value);
  if (cpf.length !== 11) throw new Error("Informe um CPF ou e-mail válido.");

  const response = await fetch("/api/resolve-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpf }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível validar o CPF.");
  return String(body.email || "").toLowerCase();
}

export const authService = {
  async login(identifier: string, password: string) {
    const email = await resolveEmail(identifier);
    try {
      return await account.createEmailPasswordSession({ email, password });
    } catch {
      throw new Error("CPF/e-mail ou senha inválidos.");
    }
  },
  current: () => account.get(),
  logout: () => account.deleteSession({ sessionId: "current" }),
};
