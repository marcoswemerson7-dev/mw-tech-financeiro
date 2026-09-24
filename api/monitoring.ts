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

const TENANTS: Record<TenantKey, {
  projectRef: string;
  url: string;
  accessUrl: string;
  keyEnv: string;
  publicKey: string;
}> = {
  rg: {
    projectRef: "kiviwxonxeqmzqlmshpc",
    url: "https://kiviwxonxeqmzqlmshpc.supabase.co",
    accessUrl: "https://gestaolicitarg.com.br",
    keyEnv: "SUPABASE_RG_SERVICE_ROLE_KEY",
    publicKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpdml3eG9ueGVxbXpxbG1zaHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDY3NzgsImV4cCI6MjA5NTU4Mjc3OH0.wBchG43tpsA8teNkK33AT8Vq5wtUl-JVTUJrIPXhkqM",
  },
  bg: {
    projectRef: "jfzavijlkbqzkrnlgphz",
    url: "https://jfzavijlkbqzkrnlgphz.supabase.co",
    accessUrl: "https://gestaolicitabrg.com.br",
    keyEnv: "SUPABASE_BG_SERVICE_ROLE_KEY",
    publicKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmemF2aWpsa2JxemtybmxncGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjkyNTgsImV4cCI6MjA5NjAwNTI1OH0.13-RRfTSeFuCg3pUYYnaQgFp93iKR4tBgVjaUDOFccU",
  },
};

async function getSnapshot(baseUrl: string, key: string, rpc: string) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase HTTP ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  return await response.json();
}

async function probeApplication(url: string) {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "MW-Tech-Monitor/1.0" },
    });
    const latencyMs = Date.now() - started;
    return {
      appLatencyMs: latencyMs,
      appState: response.ok ? (latencyMs > 800 ? "attention" : "online") : "offline",
      appCheckedAt: checkedAt,
      appStatusCode: response.status,
    };
  } catch {
    return {
      appLatencyMs: null,
      appState: "offline",
      appCheckedAt: checkedAt,
      appStatusCode: null,
    };
  }
}

async function tenantMetrics(tenant: TenantKey) {
  const config = TENANTS[tenant];
  const appProbe = await probeApplication(config.accessUrl);
  const serviceKey = process.env[config.keyEnv];
  const key = serviceKey || config.publicKey;
  const rpc = serviceKey ? "mw_control_monitoring_snapshot" : "mw_control_monitoring_snapshot_public";

  try {
    const snapshot = await getSnapshot(config.url, key, rpc);
    return {
      tenant,
      configured: true,
      ...appProbe,
      source: serviceKey ? "service" : "safe_public_snapshot",
      processes: Number(snapshot.processes ?? 0),
      contracts: Number(snapshot.contracts ?? 0),
      users: Number(snapshot.users ?? 0),
      activeUsers: Number(snapshot.activeUsers ?? snapshot.users ?? 0),
      recent30m: Number(snapshot.recent30m ?? 0),
      active24h: Number(snapshot.active24h ?? 0),
      active7d: Number(snapshot.active7d ?? 0),
      latestLoginAt: snapshot.latestLoginAt || null,
      invoices: Number(snapshot.invoices ?? 0),
      payments: Number(snapshot.payments ?? 0),
      files: Number(snapshot.files ?? 0),
      fileBytes: Number(snapshot.fileBytes ?? 0),
      supabaseStorageFiles: Number(snapshot.supabaseStorageFiles ?? 0),
      supabaseStorageBytes: Number(snapshot.supabaseStorageBytes ?? 0),
      audit24h: Number(snapshot.audit24h ?? 0),
      databaseBytes: Number(snapshot.databaseBytes ?? 0),
      checkedAt: snapshot.generatedAt || new Date().toISOString(),
    };
  } catch (error) {
    return {
      tenant,
      configured: false,
      ...appProbe,
      source: serviceKey ? "service" : "safe_public_snapshot",
      processes: null,
      contracts: null,
      users: null,
      activeUsers: null,
      recent30m: null,
      active24h: null,
      active7d: null,
      latestLoginAt: null,
      invoices: null,
      payments: null,
      files: null,
      fileBytes: null,
      supabaseStorageFiles: null,
      supabaseStorageBytes: null,
      audit24h: null,
      databaseBytes: null,
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

  const [rg, bg] = await Promise.all([tenantMetrics("rg"), tenantMetrics("bg")]);
  res.status(200).json({ ok: true, systems: [rg, bg], generatedAt: new Date().toISOString() });
}
