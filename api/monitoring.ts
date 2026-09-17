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

async function getSnapshot(baseUrl: string, key: string) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/mw_control_monitoring_snapshot`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
  return await response.json();
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
    const snapshot = await getSnapshot(config.url, key);
    return {
      tenant,
      configured: true,
      processes: Number(snapshot.processes ?? 0),
      users: Number(snapshot.users ?? 0),
      active24h: Number(snapshot.active24h ?? 0),
      invoices: Number(snapshot.invoices ?? 0),
      payments: Number(snapshot.payments ?? 0),
      audit24h: Number(snapshot.audit24h ?? 0),
      databaseBytes: Number(snapshot.databaseBytes ?? 0),
      checkedAt: snapshot.generatedAt || new Date().toISOString(),
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
