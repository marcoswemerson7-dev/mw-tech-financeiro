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
};

const DEFAULT_SYSTEMS: Record<string, AuditSystemConfig> = {
  rg: {
    label: "Prefeitura Municipal de Ribeiro Gonçalves - PI",
    url: "https://kiviwxonxeqmzqlmshpc.supabase.co",
  },
  bg: {
    label: "Prefeitura Municipal de Baixa Grande do Ribeiro - PI",
    url: "https://jfzavijlkbqzkrnlgphz.supabase.co",
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
        }])
        .filter(([, value]) => Boolean((value as AuditSystemConfig).url)),
    );
    return { ...DEFAULT_SYSTEMS, ...custom };
  } catch {
    return DEFAULT_SYSTEMS;
  }
}

const getString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

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
  return { user, jwt };
}

async function fetchSystem(systemKey: string, config: AuditSystemConfig, params: Record<string, string>, jwt: string) {
  const response = await fetch(`${config.url}/functions/v1/mw-control-audit`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mw-appwrite-jwt": jwt,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      system: systemKey,
      label: config.label,
      configured: true,
      rows: [],
      error: `Auditoria HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
    };
  }

  const body = await response.json();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  return {
    system: systemKey,
    label: config.label,
    configured: true,
    rows: rows.map((row: Record<string, unknown>) => ({ ...row, tenant: systemKey, tenant_label: config.label })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  let session: Awaited<ReturnType<typeof requireMwSession>>;
  try {
    session = await requireMwSession(req);
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

  const result = await fetchSystem(systemKey, config, params, session.jwt);
  res.status(200).json({
    ok: result.configured && !result.error,
    rows: result.rows,
    system: { key: systemKey, label: result.label, configured: result.configured, error: result.error || null },
    generatedAt: new Date().toISOString(),
  });
}
