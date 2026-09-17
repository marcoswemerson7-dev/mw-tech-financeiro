type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type TenantKey = "rg" | "bg";

const TENANTS: Record<TenantKey, { projectRef: string; url: string; keyEnv: string }> = {
  rg: {
    projectRef: "kiviwxonxeqmzqlmshpc",
    url: "https://kiviwxonxeqmzqlmshpc.supabase.co",
    keyEnv: "SUPABASE_RG_SERVICE_ROLE_KEY",
  },
  bg: {
    projectRef: "jfzavijlkbqzkrnlgphz",
    url: "https://jfzavijlkbqzkrnlgphz.supabase.co",
    keyEnv: "SUPABASE_BG_SERVICE_ROLE_KEY",
  },
};

async function countRows(baseUrl: string, key: string, table: string) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      prefer: "count=exact",
      range: "0-0",
    },
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

async function rpcNumber(baseUrl: string, key: string, fn: string) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) return null;
  const value = await response.json();
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function tenantMetrics(tenant: TenantKey) {
  const config = TENANTS[tenant];
  const key = process.env[config.keyEnv];
  if (!key) {
    return {
      tenant,
      configured: false,
      processes: null,
      users: null,
      invoices: null,
      payments: null,
      databaseBytes: null,
      errors24h: null,
      message: `${config.keyEnv} não configurada na Vercel.`,
    };
  }

  try {
    const [processes, users, invoices, payments, databaseBytes] = await Promise.all([
      countRows(config.url, key, "processos"),
      countRows(config.url, key, "profiles"),
      countRows(config.url, key, "execucao_notas_fiscais"),
      countRows(config.url, key, "execucao_pagamentos"),
      rpcNumber(config.url, key, "mw_control_database_size_bytes"),
    ]);

    return {
      tenant,
      configured: true,
      processes,
      users,
      invoices,
      payments,
      databaseBytes,
      errors24h: null,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      tenant,
      configured: true,
      processes: null,
      users: null,
      invoices: null,
      payments: null,
      databaseBytes: null,
      errors24h: null,
      message: error instanceof Error ? error.message : "Falha ao consultar Supabase.",
      checkedAt: new Date().toISOString(),
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const expected = process.env.MONITORING_ACCESS_KEY;
  const provided = Array.isArray(req.headers["x-monitoring-key"])
    ? req.headers["x-monitoring-key"][0]
    : req.headers["x-monitoring-key"];

  if (expected && provided !== expected) {
    res.status(401).json({ error: "Não autorizado." });
    return;
  }

  const [rg, bg] = await Promise.all([tenantMetrics("rg"), tenantMetrics("bg")]);
  res.status(200).json({ ok: true, systems: [rg, bg], generatedAt: new Date().toISOString() });
}
