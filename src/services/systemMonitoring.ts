import { getManagedSystems, type ManagedSystem } from "./managedSystems";

export type HealthState = "online" | "attention" | "offline" | "checking" | "unconfigured";

export type EndpointHealth = {
  state: HealthState;
  latencyMs: number | null;
  checkedAt: string;
  url: string;
  message: string;
};

export type MonitoringMetrics = {
  configured: boolean;
  source?: string;
  processes: number | null;
  contracts: number | null;
  users: number | null;
  activeUsers: number | null;
  recent30m: number | null;
  active24h: number | null;
  active7d: number | null;
  latestLoginAt: string | null;
  invoices: number | null;
  payments: number | null;
  files: number | null;
  fileBytes: number | null;
  audit24h: number | null;
  databaseBytes: number | null;
  checkedAt?: string;
  message?: string;
};

export type SystemHealthSnapshot = {
  key: string;
  tenantKey: "rg" | "bg" | null;
  name: string;
  shortName: string;
  city: string;
  accessUrl: string;
  vercelUrl: string;
  supabaseUrl: string;
  logoUrl: string;
  app: EndpointHealth;
  database: EndpointHealth;
  backend: EndpointHealth;
  overall: HealthState;
  metrics: MonitoringMetrics | null;
};

const FALLBACKS = {
  rg: {
    name: "Prefeitura Municipal de Ribeiro Gonçalves - PI",
    shortName: "Gestão Licita RG",
    city: "Ribeiro Gonçalves - PI",
    accessUrl: "https://gestaolicitarg.com.br",
    supabaseUrl: "https://kiviwxonxeqmzqlmshpc.supabase.co/rest/v1/",
    healthUrl: "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-health",
  },
  bg: {
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro - PI",
    shortName: "Gestão Licita BG",
    city: "Baixa Grande do Ribeiro - PI",
    accessUrl: "https://gestaolicitabrg.com.br",
    supabaseUrl: "https://jfzavijlkbqzkrnlgphz.supabase.co/rest/v1/",
    healthUrl: "https://jfzavijlkbqzkrnlgphz.supabase.co/functions/v1/mw-health",
  },
};

function safeUrl(value?: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function projectRestUrl(value?: string) {
  const url = safeUrl(value);
  if (!url) return "";
  const direct = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (direct) return `https://${direct[1]}.supabase.co/rest/v1/`;
  const dashboard = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1]}.supabase.co/rest/v1/`;
  return url;
}

function inferTenant(item?: Partial<ManagedSystem> | null): "rg" | "bg" | null {
  const haystack = `${item?.orgao || ""} ${item?.dominio_url || ""} ${item?.acesso_url || ""} ${item?.supabase_url || ""}`.toLowerCase();
  if (
    haystack.includes("ribeiro gonçalves") ||
    haystack.includes("ribeiro goncalves") ||
    haystack.includes("gestaolicitarg") ||
    haystack.includes("kiviwxonxeqmzqlmshpc")
  ) return "rg";
  if (
    haystack.includes("baixa grande") ||
    haystack.includes("gestaolicitabrg") ||
    haystack.includes("jfzavijlkbqzkrnlgphz")
  ) return "bg";
  return null;
}

function unconfiguredHealth(message: string): EndpointHealth {
  return {
    state: "unconfigured",
    latencyMs: null,
    checkedAt: new Date().toISOString(),
    url: "",
    message,
  };
}

async function probe(url: string, timeoutMs = 8000): Promise<EndpointHealth> {
  const checkedAt = new Date().toISOString();
  if (!url) return unconfiguredHealth("Não configurado");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    const state: HealthState = latencyMs > 2500 ? "attention" : "online";
    return {
      state,
      latencyMs,
      checkedAt,
      url,
      message: state === "online" ? "Respondendo normalmente" : "Respondendo com lentidão",
    };
  } catch {
    return {
      state: "offline",
      latencyMs: null,
      checkedAt,
      url,
      message: controller.signal.aborted ? "Tempo limite excedido" : "Não foi possível alcançar o serviço",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function probeHealth(url: string, timeoutMs = 8000): Promise<EndpointHealth> {
  const checkedAt = new Date().toISOString();
  if (!url) return unconfiguredHealth("Health check interno não configurado");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
    const latencyMs = Math.round(performance.now() - started);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) {
      return {
        state: "offline",
        latencyMs,
        checkedAt,
        url,
        message: body.error || "Health check interno falhou",
      };
    }
    return {
      state: latencyMs > 1800 ? "attention" : "online",
      latencyMs,
      checkedAt: body.checkedAt || checkedAt,
      url,
      message: latencyMs > 1800 ? "Backend respondendo com lentidão" : "Backend e banco operacionais",
    };
  } catch {
    return {
      state: "offline",
      latencyMs: null,
      checkedAt,
      url,
      message: controller.signal.aborted ? "Health check excedeu o tempo limite" : "Backend não respondeu",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadMetrics() {
  try {
    const response = await fetch("/api/monitoring", { cache: "no-store" });
    if (!response.ok) return new Map<"rg" | "bg", MonitoringMetrics>();
    const data = await response.json();
    return new Map<"rg" | "bg", MonitoringMetrics>(
      (data.systems || []).map((item: MonitoringMetrics & { tenant: "rg" | "bg" }) => [item.tenant, item]),
    );
  } catch {
    return new Map<"rg" | "bg", MonitoringMetrics>();
  }
}

function combine(app: EndpointHealth, database: EndpointHealth, backend: EndpointHealth): HealthState {
  const configuredStates = [app, database, backend].filter((item) => item.state !== "unconfigured");
  if (!configuredStates.length) return "unconfigured";
  if (configuredStates.some((item) => item.state === "offline")) return "offline";
  if (configuredStates.some((item) => item.state === "attention")) return "attention";
  if (configuredStates.every((item) => item.state === "online")) return "online";
  return "attention";
}

export async function getSystemHealth(): Promise<SystemHealthSnapshot[]> {
  let rows: ManagedSystem[] = [];
  try {
    rows = await getManagedSystems();
  } catch {
    rows = [];
  }

  const metrics = await loadMetrics();
  const activeRows = rows.filter((item) => String(item.status || "ativo").toLowerCase() !== "inativo");

  const sourceRows: ManagedSystem[] = activeRows.length
    ? activeRows
    : ([
        {
          id: "fallback-rg",
          orgao: FALLBACKS.rg.name,
          tipo_orgao: "Prefeitura",
          sistema: FALLBACKS.rg.shortName,
          dominio_url: FALLBACKS.rg.accessUrl,
          acesso_url: FALLBACKS.rg.accessUrl,
          supabase_url: FALLBACKS.rg.supabaseUrl,
          ambiente: "Produção",
          status: "ativo",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "fallback-bg",
          orgao: FALLBACKS.bg.name,
          tipo_orgao: "Prefeitura",
          sistema: FALLBACKS.bg.shortName,
          dominio_url: FALLBACKS.bg.accessUrl,
          acesso_url: FALLBACKS.bg.accessUrl,
          supabase_url: FALLBACKS.bg.supabaseUrl,
          ambiente: "Produção",
          status: "ativo",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ] as ManagedSystem[]);

  return Promise.all(
    sourceRows.map(async (stored) => {
      const tenantKey = inferTenant(stored);
      const fallback = tenantKey ? FALLBACKS[tenantKey] : null;
      const accessUrl = safeUrl(stored.acesso_url || stored.dominio_url || fallback?.accessUrl || "");
      const supabaseUrl = projectRestUrl(stored.supabase_url || fallback?.supabaseUrl || "");
      const vercelUrl = safeUrl(stored.vercel_url || "");
      const healthUrl = fallback?.healthUrl || "";

      const [app, database, backend] = await Promise.all([
        probe(accessUrl),
        supabaseUrl ? probe(supabaseUrl) : Promise.resolve(unconfiguredHealth("Supabase não informado")),
        healthUrl ? probeHealth(healthUrl) : Promise.resolve(unconfiguredHealth("Health check interno ainda não configurado")),
      ]);

      return {
        key: stored.id || tenantKey || accessUrl || stored.orgao,
        tenantKey,
        name: stored.orgao || fallback?.name || "Sistema monitorado",
        shortName: stored.sistema || fallback?.shortName || stored.orgao || "Sistema",
        city: stored.orgao || fallback?.city || "",
        accessUrl,
        vercelUrl,
        supabaseUrl,
        logoUrl: stored.logo_url || "",
        app,
        database,
        backend,
        overall: combine(app, database, backend),
        metrics: tenantKey ? metrics.get(tenantKey) || null : null,
      };
    }),
  );
}
