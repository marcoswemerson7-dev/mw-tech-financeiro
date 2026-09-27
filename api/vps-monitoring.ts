type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type ServiceState = "online" | "offline" | "unknown";

function serviceState(value: unknown): ServiceState {
  if (value === true || value === "online" || value === "running" || value === "active" || value === "healthy") return "online";
  if (value === false || value === "offline" || value === "stopped" || value === "inactive" || value === "failed" || value === "unhealthy") return "offline";
  return "unknown";
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const healthUrl = String(process.env.VPS_TEST_HEALTH_URL || "").trim();
  const token = String(process.env.VPS_TEST_HEALTH_TOKEN || "").trim();

  if (!healthUrl) {
    res.status(200).json({
      ok: true,
      configured: false,
      message: "Endpoint de telemetria da VPS ainda não configurado.",
      checkedAt: new Date().toISOString(),
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const started = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "MW-Tech-Control/1.0",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const latencyMs = Date.now() - started;
    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      res.status(200).json({
        ok: true,
        configured: true,
        reachable: false,
        latencyMs,
        statusCode: response.status,
        message: raw?.error || `Health endpoint respondeu HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    const services = raw?.services || {};
    const memory = raw?.memory || {};
    const disk = raw?.disk || {};
    const load = raw?.load || {};

    res.status(200).json({
      ok: true,
      configured: true,
      reachable: true,
      latencyMs,
      statusCode: response.status,
      hostname: String(raw?.hostname || raw?.host || ""),
      os: String(raw?.os || raw?.operatingSystem || ""),
      kernel: String(raw?.kernel || ""),
      uptimeSeconds: numberOrNull(raw?.uptimeSeconds ?? raw?.uptime),
      cpuPercent: numberOrNull(raw?.cpuPercent ?? raw?.cpu?.percent ?? raw?.cpu),
      memoryUsedBytes: numberOrNull(memory?.usedBytes ?? raw?.memoryUsedBytes),
      memoryTotalBytes: numberOrNull(memory?.totalBytes ?? raw?.memoryTotalBytes),
      memoryPercent: numberOrNull(memory?.percent ?? raw?.memoryPercent),
      diskUsedBytes: numberOrNull(disk?.usedBytes ?? raw?.diskUsedBytes),
      diskTotalBytes: numberOrNull(disk?.totalBytes ?? raw?.diskTotalBytes),
      diskPercent: numberOrNull(disk?.percent ?? raw?.diskPercent),
      load1: numberOrNull(load?.one ?? raw?.load1),
      load5: numberOrNull(load?.five ?? raw?.load5),
      load15: numberOrNull(load?.fifteen ?? raw?.load15),
      docker: serviceState(services?.docker ?? raw?.docker),
      nginx: serviceState(services?.nginx ?? raw?.nginx),
      postgres: serviceState(services?.postgres ?? services?.postgresql ?? raw?.postgres),
      app: serviceState(services?.app ?? raw?.app),
      sslValid: typeof raw?.sslValid === "boolean" ? raw.sslValid : null,
      sslExpiresAt: raw?.sslExpiresAt || null,
      publicIp: String(raw?.publicIp || raw?.ip || ""),
      version: String(raw?.version || ""),
      checkedAt: raw?.checkedAt || new Date().toISOString(),
    });
  } catch (error) {
    res.status(200).json({
      ok: true,
      configured: true,
      reachable: false,
      latencyMs: null,
      message: controller.signal.aborted
        ? "Tempo limite excedido ao consultar a VPS."
        : error instanceof Error ? error.message : "Não foi possível consultar a VPS.",
      checkedAt: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeout);
  }
}
