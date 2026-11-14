type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type TenantKey = "rg" | "bg" | "camara_licita" | "camara_frota" | "camara_patrimonio" | "vps_test";

const TENANTS: Record<TenantKey, {
  projectRef: string;
  url: string;
  accessUrl: string;
  keyEnv: string;
  publicKey?: string;
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
  camara_licita: {
    projectRef: "qnitcxoekxkwyqoirdka",
    url: "https://qnitcxoekxkwyqoirdka.supabase.co",
    accessUrl: "https://camara-rg.gestaolicitacoes.com.br",
    keyEnv: "SUPABASE_CAMARA_LICITA_SERVICE_ROLE_KEY",
    publicKey: process.env.SUPABASE_CAMARA_LICITA_ANON_KEY,
  },
  camara_frota: {
    projectRef: "uydappvzmdpkkyxslrye",
    url: "https://uydappvzmdpkkyxslrye.supabase.co",
    accessUrl: "https://frota-camara-rg.mwtechsistemas.com.br",
    keyEnv: "SUPABASE_CAMARA_FROTA_SERVICE_ROLE_KEY",
    publicKey: process.env.SUPABASE_CAMARA_FROTA_ANON_KEY,
  },
  camara_patrimonio: {
    projectRef: "ybljkroautoqzmifrkbi",
    url: "https://ybljkroautoqzmifrkbi.supabase.co",
    accessUrl: "https://patrimonio-camara-rg.mwtechsistemas.com.br",
    keyEnv: "SUPABASE_CAMARA_PATRIMONIO_SERVICE_ROLE_KEY",
    publicKey: process.env.SUPABASE_CAMARA_PATRIMONIO_ANON_KEY,
  },
  vps_test: {
    projectRef: "",
    url: "",
    accessUrl: "https://gestao-licitacoes-teste.vercel.app",
    keyEnv: "SUPABASE_TESTE_SERVICE_ROLE_KEY",
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

async function probeOnce(url: string) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: { "user-agent": "MW-Tech-Monitor/2.0" },
    });

    // Alguns hosts não implementam HEAD corretamente. Nesses casos, usa GET
    // somente como contingência.
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: { "user-agent": "MW-Tech-Monitor/2.0" },
      });
    }

    return {
      ok: response.ok,
      latencyMs: Math.round(performance.now() - started),
      statusCode: response.status,
      cacheStatus: response.headers.get("x-vercel-cache") || response.headers.get("cf-cache-status") || null,
      cacheAgeSeconds: response.headers.has("age") ? Number(response.headers.get("age")) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Duas requisições sequenciais para comparar a primeira e a segunda resposta.
// O runtime pode reutilizar a conexão, mas fetch não garante isso; portanto,
// estas durações NÃO isolam DNS, TLS ou latência da aplicação.
async function probeApplication(url: string) {
  const checkedAt = new Date().toISOString();
  try {
    const initial = await probeOnce(url);
    if (!initial.ok) return {
      appLatencyMs: initial.latencyMs,
      appColdLatencyMs: initial.latencyMs,
      appState: "offline",
      appCheckedAt: checkedAt,
      appStatusCode: initial.statusCode,
      appCacheStatus: initial.cacheStatus,
      appCacheAgeSeconds: initial.cacheAgeSeconds,
    };

    let warm = initial;
    try {
      warm = await probeOnce(url);
    } catch {
      // Se a segunda tentativa falhar, manter a leitura real da primeira.
    }
    return {
      appLatencyMs: warm.latencyMs,
      appColdLatencyMs: initial.latencyMs,
      appState: warm.ok ? (warm.latencyMs > 800 ? "attention" : "online") : "offline",
      appCheckedAt: checkedAt,
      appStatusCode: warm.statusCode,
      appCacheStatus: warm.cacheStatus,
      appCacheAgeSeconds: warm.cacheAgeSeconds,
    };
  } catch {
    return {
      appLatencyMs: null,
      appColdLatencyMs: null,
      appState: "offline",
      appCheckedAt: checkedAt,
      appStatusCode: null,
      appCacheStatus: null,
      appCacheAgeSeconds: null,
    };
  }
}

async function tenantMetrics(tenant: TenantKey) {
  const config = TENANTS[tenant];
  const appProbe = await probeApplication(config.accessUrl);
  const serviceKey = process.env[config.keyEnv];
  const key = serviceKey || config.publicKey;
  const rpc = serviceKey ? "mw_control_monitoring_snapshot" : "mw_control_monitoring_snapshot_public";

  // Sistemas novos podem estar acessíveis antes de a telemetria SQL ser implantada.
  // Nunca apresentar zeros inventados ou consultar tabelas privadas sem credencial.
  if (!key) return {
    tenant,
    configured: false,
    ...appProbe,
    source: "telemetry_not_configured",
    processes: null, contracts: null, users: null, activeUsers: null,
    recent30m: null, active24h: null, active7d: null, latestLoginAt: null,
    invoices: null, payments: null, files: null, fileBytes: null,
    supabaseStorageFiles: null, supabaseStorageBytes: null, audit24h: null,
    databaseBytes: null, extra: null,
    message: "Monitoramento da aplicação ativo; métricas do banco dependem da instalação da função RPC e chave de serviço no servidor.",
    checkedAt: new Date().toISOString(),
  };

  try {
    const snapshot = await getSnapshot(config.url, key, rpc);
    return {
      tenant,
      configured: true,
      ...appProbe,
      source: serviceKey ? "service" : "safe_public_snapshot",
      processes: snapshot.processes === null || snapshot.processes === undefined ? null : Number(snapshot.processes),
      contracts: snapshot.contracts === null || snapshot.contracts === undefined ? null : Number(snapshot.contracts),
      users: snapshot.users === null || snapshot.users === undefined ? null : Number(snapshot.users),
      activeUsers: snapshot.activeUsers === null || snapshot.activeUsers === undefined ? null : Number(snapshot.activeUsers),
      recent30m: snapshot.recent30m === null || snapshot.recent30m === undefined ? null : Number(snapshot.recent30m),
      active24h: snapshot.active24h === null || snapshot.active24h === undefined ? null : Number(snapshot.active24h),
      active7d: snapshot.active7d === null || snapshot.active7d === undefined ? null : Number(snapshot.active7d),
      invoices: snapshot.invoices === null || snapshot.invoices === undefined ? null : Number(snapshot.invoices),
      payments: snapshot.payments === null || snapshot.payments === undefined ? null : Number(snapshot.payments),
      files: snapshot.files === null || snapshot.files === undefined ? null : Number(snapshot.files),
      fileBytes: snapshot.fileBytes === null || snapshot.fileBytes === undefined ? null : Number(snapshot.fileBytes),
      supabaseStorageFiles: snapshot.supabaseStorageFiles === null || snapshot.supabaseStorageFiles === undefined ? null : Number(snapshot.supabaseStorageFiles),
      supabaseStorageBytes: snapshot.supabaseStorageBytes === null || snapshot.supabaseStorageBytes === undefined ? null : Number(snapshot.supabaseStorageBytes),
      audit24h: snapshot.audit24h === null || snapshot.audit24h === undefined ? null : Number(snapshot.audit24h),
      databaseBytes: snapshot.databaseBytes === null || snapshot.databaseBytes === undefined ? null : Number(snapshot.databaseBytes),
      latestLoginAt: snapshot.latestLoginAt || null,
      extra: snapshot.extra && typeof snapshot.extra === "object" ? snapshot.extra : null,
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
      extra: null,
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

  const keys: TenantKey[] = ["rg", "bg", "camara_licita", "camara_frota", "camara_patrimonio", "vps_test"];
  const systems = await Promise.all(keys.map((key) => tenantMetrics(key)));
  res.status(200).json({ ok: true, systems, generatedAt: new Date().toISOString() });
}
