type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type TenantKey = "rg" | "bg";

const TENANTS: Record<TenantKey, { label: string; url: string; keyEnv: string }> = {
  rg: {
    label: "Ribeiro Gonçalves",
    url: "https://kiviwxonxeqmzqlmshpc.supabase.co",
    keyEnv: "SUPABASE_RG_SERVICE_ROLE_KEY",
  },
  bg: {
    label: "Baixa Grande do Ribeiro",
    url: "https://jfzavijlkbqzkrnlgphz.supabase.co",
    keyEnv: "SUPABASE_BG_SERVICE_ROLE_KEY",
  },
};

const getString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

function escapeFilter(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

async function fetchTenant(tenant: TenantKey, params: Record<string, string>) {
  const config = TENANTS[tenant];
  const key = process.env[config.keyEnv];
  if (!key) {
    return { tenant, label: config.label, configured: false, rows: [], error: `${config.keyEnv} não configurada.` };
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
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      tenant,
      label: config.label,
      configured: true,
      rows: [],
      error: `Supabase HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
    };
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  return {
    tenant,
    label: config.label,
    configured: true,
    rows: rows.map((row) => ({ ...row, tenant, tenant_label: config.label })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const tenantParam = getString(req.query.tenant).toLowerCase();
  const tenants: TenantKey[] = tenantParam === "rg" ? ["rg"] : tenantParam === "bg" ? ["bg"] : ["rg", "bg"];
  const params = {
    from: getString(req.query.from),
    to: getString(req.query.to),
    user: getString(req.query.user),
    action: getString(req.query.action),
    module: getString(req.query.module),
    process: getString(req.query.process),
    limit: String(Math.min(Math.max(Number(getString(req.query.limit)) || 2000, 100), 5000)),
  };

  const results = await Promise.all(tenants.map((tenant) => fetchTenant(tenant, params)));
  const rows = results.flatMap((item) => item.rows).sort((a: any, b: any) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  res.status(200).json({
    ok: results.some((item) => item.configured && !item.error),
    rows,
    systems: results.map(({ tenant, label, configured, error }) => ({ tenant, label, configured, error: error || null })),
    generatedAt: new Date().toISOString(),
  });
}
