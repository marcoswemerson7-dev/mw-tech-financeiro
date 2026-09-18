import { Client, Query, Users } from "node-appwrite";

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const cpf = onlyDigits((req.body as { cpf?: string } | undefined)?.cpf);
  if (!isValidCpf(cpf)) {
    res.status(400).json({ error: "CPF inválido." });
    return;
  }

  const endpoint = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "6a9194e0002bdfa75d97";
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    res.status(503).json({ error: "Login por CPF ainda não está configurado no servidor." });
    return;
  }

  try {
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const users = new Users(client);
    const result = await users.list({ queries: [Query.limit(500)] });
    const match = (result.users || []).find((user) => onlyDigits(user.prefs?.cpf) === cpf);

    if (!match || String(match.prefs?.mw_control_status || "ativo").toLowerCase() !== "ativo") {
      res.status(401).json({ error: "CPF ou senha inválidos." });
      return;
    }

    res.status(200).json({ ok: true, email: match.email });
  } catch (error) {
    console.error("resolve-login", error);
    res.status(500).json({ error: "Não foi possível validar o CPF agora." });
  }
}
