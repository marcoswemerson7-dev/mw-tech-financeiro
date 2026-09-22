import { account } from "../lib/appwrite";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getAppwriteLoginError(error: unknown) {
  const err = error as {
    code?: number;
    type?: string;
    message?: string;
    response?: { message?: string; type?: string; code?: number };
  };

  const code = Number(err?.code ?? err?.response?.code ?? 0);
  const type = String(err?.type ?? err?.response?.type ?? "").toLowerCase();
  const message = String(err?.message ?? err?.response?.message ?? "").trim();
  const normalized = `${type} ${message}`.toLowerCase();

  if (
    code === 401
    || normalized.includes("user_invalid_credentials")
    || normalized.includes("invalid credentials")
  ) {
    return new Error("E-mail/CPF ou senha inválidos.");
  }

  if (
    code === 403
    || normalized.includes("user_blocked")
    || normalized.includes("blocked")
    || normalized.includes("disabled")
  ) {
    return new Error("Sua conta está bloqueada ou desativada. Entre em contato com o administrador.");
  }

  if (
    code === 429
    || normalized.includes("rate limit")
    || normalized.includes("too many requests")
  ) {
    return new Error("Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.");
  }

  if (
    normalized.includes("failed to fetch")
    || normalized.includes("network")
    || normalized.includes("load failed")
  ) {
    return new Error("Não foi possível conectar ao serviço de autenticação. Verifique sua internet e tente novamente.");
  }

  if (
    normalized.includes("project_unknown")
    || normalized.includes("project not found")
    || normalized.includes("invalid project")
    || normalized.includes("project_invalid")
  ) {
    return new Error("O serviço de autenticação está com a configuração do projeto inválida. Verifique o Appwrite.");
  }

  if (
    normalized.includes("origin")
    || normalized.includes("cors")
    || normalized.includes("platform")
    || normalized.includes("hostname")
  ) {
    return new Error("Este domínio ainda não está autorizado no Appwrite. Verifique as plataformas/domínios do projeto.");
  }

  const technicalType = type ? ` [${type}]` : "";
  const technicalCode = code ? ` (código ${code})` : "";
  const safeMessage = message && !/password|secret|token/i.test(message)
    ? `: ${message}`
    : "";

  return new Error(`Falha no serviço de autenticação${technicalType}${technicalCode}${safeMessage}`);
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
    } catch (error) {
      console.error("[AUTH-LOGIN]", {
        code: (error as any)?.code,
        type: (error as any)?.type,
        message: (error as any)?.message,
      });
      throw getAppwriteLoginError(error);
    }
  },
  current: () => account.get(),
  logout: () => account.deleteSession({ sessionId: "current" }),
};
