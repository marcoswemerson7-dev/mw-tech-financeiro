import { Account, Client } from "node-appwrite";

type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type AuditSystemConfig = {
  label: string;
  url: string;
  keyEnv: string;
};

const DEFAULT_SYSTEMS: Record<string, AuditSystemConfig> = {
  rg: {
    label: "Prefeitura Municipal de Ribeiro Gonçalves - PI",
    url: "https://kiviwxonxeqmzqlmshpc.supabase.co",
    keyEnv: "SUPABASE_RG_SERVICE_ROLE_KEY",
  },
  bg: {
    label: "Prefeitura Municipal de Baixa Grande do Ribeiro - PI",
    url: "https://jfzavijlkbqzkrnlgphz.supabase.co",
    keyEnv: "SUPABASE_BG_SERVICE_ROLE_KEY",
  },
};

function registry(): Record<string, AuditSystemConfig> {
  const raw = process.env.MONITORED_SUPABASE_SYSTEMS;
  if (!raw) return DEFAULT_SYSTEMS;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<AuditSystemConfig>>;
    const custom = Object.fromEntries(
      Object.entries(parsed || {})
        .map(([key, value]) => [key.toLowerCase(), {
          label: String(value.label || key),
          url: String(value.url || "").replace(/\/$/, ""),
          keyEnv: String(value.keyEnv || `SUPABASE_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_SERVICE_ROLE_KEY`),
        }])
        .filter(([, value]) => Boolean((value as AuditSystemConfig).url)),
    );
    return { ...DEFAULT_SYSTEMS, ...custom };
  } catch {
    return DEFAULT_SYSTEMS;
  }
}

const getString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

function escapeFilter(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

async function requireMwSession(req: VercelRequest) {
  const raw = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const jwt = String(raw || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("missing_session");

  const endpoint = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "6a9194e0002bdfa75d97";
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  const account = new Account(client);
  const user = await account.get();
  if (!user?.$id) throw new Error("invalid_session");
  return user;
}

async function fetchSystem(systemKey: string, config: AuditSystemConfig, params: Record<string, string>) {
  const key = process.env[config.keyEnv];
  if (!key) {
    return { system: systemKey, label: config.label, configured: false, rows: [], error: `${config.keyEnv} não configurada no servidor.` };
  }

  const search = new URLSearchParams();
  search.set("select", "*");
  search.set("order", "created_at.desc");
  search.set("limit", params.limit || "2000");
  if (params.from) search.set("created_at", `gte.${params.from}T00:00:00-03:00`);
  if (params.to) search.append("created_at", `lte.${params.to}T23:59:59-03:00`);
  if (params.user) search.set("user_email", `eq.${escapeFilter(params.user)}`);
  if (params.action) search.set("action_type", `eq.${escapeFilter(params.action)}`);
  if (params.module) search.set("module", `eq.${escapeFilter(params.module)}`);
  if (params.process) search.set("process_number", `ilike.*${escapeFilter(params.process)}*`);

  const response = await fetch(`${config.url}/rest/v1/audit_logs?${search.toString()}`, {
    headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      system: systemKey,
      label: config.label,
      configured: true,
      rows: [],
      error: `Supabase HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
    };
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  return {
    system: systemKey,
    label: config.label,
    configured: true,
    rows: rows.map((row) => ({ ...row, tenant: systemKey, tenant_label: config.label })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  try {
    await requireMwSession(req);
  } catch {
    res.status(401).json({ error: "Sessão administrativa inválida ou expirada." });
    return;
  }

  const systemKey = getString(req.query.system || req.query.tenant).trim().toLowerCase();
  if (!systemKey) {
    res.status(400).json({ error: "Selecione um sistema no Monitoramento para abrir a auditoria." });
    return;
  }

  const systems = registry();
  const config = systems[systemKey];
  if (!config) {
    res.status(404).json({
      error: "A auditoria deste sistema ainda não possui integração configurada.",
      system: systemKey,
      expectedEnv: `SUPABASE_${systemKey.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_SERVICE_ROLE_KEY`,
    });
    return;
  }

  const params = {
    from: getString(req.query.from),
    to: getString(req.query.to),
    user: getString(req.query.user),
    action: getString(req.query.action),
    module: getString(req.query.module),
    process: getString(req.query.process),
    limit: String(Math.min(Math.max(Number(getString(req.query.limit)) || 2000, 100), 5000)),
  };

  const result = await fetchSystem(systemKey, config, params);
  res.status(200).json({
    ok: result.configured && !result.error,
    rows: result.rows,
    system: { key: systemKey, label: result.label, configured: result.configured, error: result.error || null },
    generatedAt: new Date().toISOString(),
  });
}
