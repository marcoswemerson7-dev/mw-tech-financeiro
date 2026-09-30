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
    };
  } finally {
    clearTimeout(timeout);
  }
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

async function probeApplication(url: string) {
  const checkedAt = new Date().toISOString();

  try {
    // A primeira chamada pode carregar DNS/TLS/conexão da função serverless.
    // Ela serve apenas para aquecer a conexão e não entra no valor exibido.
    await probeOnce(url).catch(() => null);

    const samples: Awaited<ReturnType<typeof probeOnce>>[] = [];
    for (let index = 0; index < 3; index += 1) {
      try {
        samples.push(await probeOnce(url));
      } catch {
        // Uma amostra isolada não deve transformar um sistema saudável em pico.
      }
    }

    const successful = samples.filter((sample) => sample.ok);
    if (!successful.length) {
      const last = samples[samples.length - 1];
      return {
        appLatencyMs: last?.latencyMs ?? null,
        appState: "offline",
        appCheckedAt: checkedAt,
        appStatusCode: last?.statusCode ?? null,
      };
    }

    const latencyMs = median(successful.map((sample) => sample.latencyMs));
    const state = latencyMs > 800 ? "attention" : "online";
    const representative = successful.reduce((best, sample) =>
      Math.abs(sample.latencyMs - latencyMs) < Math.abs(best.latencyMs - latencyMs) ? sample : best
    );

    return {
      appLatencyMs: latencyMs,
      appState: state,
      appCheckedAt: checkedAt,
      appStatusCode: representative.statusCode,
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
