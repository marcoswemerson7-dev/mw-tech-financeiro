import { getManagedSystems, type ManagedSystem } from "./managedSystems";

export type HealthState = "online" | "attention" | "offline" | "checking" | "unconfigured";

export type EndpointHealth = {
  state: HealthState;
  latencyMs: number | null;
  checkedAt: string;
  url: string;
  message: string;
};

export type SystemHealthSnapshot = {
  key: "rg" | "bg";
  name: string;
  shortName: string;
  city: string;
  accessUrl: string;
  vercelUrl: string;
  supabaseUrl: string;
  app: EndpointHealth;
  database: EndpointHealth;
  overall: HealthState;
};

const FALLBACKS = {
  rg: {
    key: "rg" as const,
    name: "Prefeitura Municipal de Ribeiro Gonçalves - PI",
    shortName: "Ribeiro Gonçalves",
    city: "Ribeiro Gonçalves - PI",
    accessUrl: "https://gestaolicitarg.com.br",
    supabaseUrl: "https://kiviwxonxeqmzqlmshpc.supabase.co/rest/v1/",
  },
  bg: {
    key: "bg" as const,
    name: "Prefeitura Municipal de Baixa Grande do Ribeiro - PI",
    shortName: "Baixa Grande do Ribeiro",
    city: "Baixa Grande do Ribeiro - PI",
    accessUrl: "https://gestaolicitabrg.com.br",
    supabaseUrl: "https://jfzavijlkbqzkrnlgphz.supabase.co/rest/v1/",
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

function findSystem(rows: ManagedSystem[], key: "rg" | "bg") {
  return rows.find((item) => {
    const haystack = `${item.orgao || ""} ${item.dominio_url || ""} ${item.acesso_url || ""}`.toLowerCase();
    return key === "rg"
      ? haystack.includes("ribeiro gonçalves") || haystack.includes("ribeiro goncalves") || haystack.includes("gestaolicitarg")
      : haystack.includes("baixa grande") || haystack.includes("gestaolicitabrg");
  });
}

async function probe(url: string, timeoutMs = 8000): Promise<EndpointHealth> {
  const checkedAt = new Date().toISOString();
  if (!url) {
    return { state: "unconfigured", latencyMs: null, checkedAt, url: "", message: "Não configurado" };
  }

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
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      state: "offline",
      latencyMs: null,
      checkedAt,
      url,
      message: aborted ? "Tempo limite excedido" : "Não foi possível alcançar o serviço",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function combine(app: EndpointHealth, database: EndpointHealth): HealthState {
  if (app.state === "offline" || database.state === "offline") return "offline";
  if (app.state === "attention" || database.state === "attention") return "attention";
  if (app.state === "online" && database.state === "online") return "online";
  return "attention";
}

export async function getSystemHealth(): Promise<SystemHealthSnapshot[]> {
  let rows: ManagedSystem[] = [];
  try {
    rows = await getManagedSystems();
  } catch {
    rows = [];
  }

  return Promise.all((["rg", "bg"] as const).map(async (key) => {
    const fallback = FALLBACKS[key];
    const stored = findSystem(rows, key);
    const accessUrl = safeUrl(stored?.acesso_url || stored?.dominio_url || fallback.accessUrl);
    const supabaseUrl = projectRestUrl(stored?.supabase_url || fallback.supabaseUrl);
    const vercelUrl = safeUrl(stored?.vercel_url || "");

    const [app, database] = await Promise.all([
      probe(accessUrl),
      probe(supabaseUrl),
    ]);

    return {
      key,
      name: stored?.orgao || fallback.name,
      shortName: fallback.shortName,
      city: fallback.city,
      accessUrl,
      vercelUrl,
      supabaseUrl,
      app,
      database,
      overall: combine(app, database),
    };
  }));
}
