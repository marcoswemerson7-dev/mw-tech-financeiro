import { getSystemHealth, type SystemHealthSnapshot } from "./systemMonitoring";
import { getTechnicalMonitoring } from "./technicalMonitoring";
import { getObservability } from "./observability";
import { acknowledgeCentralIncident, listCentralIncidents, syncCentralIncidents } from "./centralMonitoring";

export type IncidentSeverity = "critical" | "warning" | "info";
export type IncidentSystem = string;

export type MonitoringIncident = {
  id: string;
  system: IncidentSystem;
  systemLabel: string;
  severity: IncidentSeverity;
  source: "health" | "sentry" | "vercel" | "operation";
  title: string;
  message: string;
  occurredAt: string;
  actionUrl?: string | null;
  active: boolean;
};

export type IncidentHistoryItem = MonitoringIncident & {
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  resolvedAt?: string | null;
  acknowledged?: boolean;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string;
};

const HISTORY_KEY = "mw-control:incident-history";

function nowIso() { return new Date().toISOString(); }
function systemLabel(key: IncidentSystem) {
  if (key === "rg") return "Gestão Licita RG";
  if (key === "bg") return "Gestão Licita BG";
  if (key === "mw") return "MW TECH Control";
  return key || "Sistema monitorado";
}

function healthIncidents(items: SystemHealthSnapshot[]): MonitoringIncident[] {
  const result: MonitoringIncident[] = [];
  for (const item of items) {
    const system: IncidentSystem = item.tenantKey || item.key;
    if (item.backend.state === "offline") {
      result.push({
        id: `health:${system}:backend-offline`,
        system, systemLabel: item.shortName || systemLabel(system), severity: "critical", source: "health",
        title: "Backend sem resposta",
        message: item.backend.message,
        occurredAt: item.backend.checkedAt || nowIso(),
        active: true,
      });
    } else if (item.backend.state === "attention") {
      result.push({
        id: `health:${system}:backend-slow`,
        system, systemLabel: item.shortName || systemLabel(system), severity: "warning", source: "health",
        title: "Backend com lentidão",
        message: item.backend.latencyMs ? `Health check respondeu em ${item.backend.latencyMs} ms.` : item.backend.message,
        occurredAt: item.backend.checkedAt || nowIso(),
        active: true,
      });
    }

    if (item.app.state === "offline") {
      result.push({
        id: `health:${system}:app-offline`,
        system, systemLabel: item.shortName || systemLabel(system), severity: "critical", source: "health",
        title: "Sistema indisponível",
        message: item.app.message,
        occurredAt: item.app.checkedAt || nowIso(),
        actionUrl: item.accessUrl,
        active: true,
      });
    } else if ((item.app.latencyMs || 0) > 2500) {
      result.push({
        id: `health:${system}:app-latency`,
        system, systemLabel: item.shortName || systemLabel(system), severity: "warning", source: "health",
        title: "Tempo de resposta elevado",
        message: `Aplicação respondeu em ${item.app.latencyMs} ms.`,
        occurredAt: item.app.checkedAt || nowIso(),
        actionUrl: item.accessUrl,
        active: true,
      });
    }

    if (item.database.state === "offline") {
      result.push({
        id: `health:${system}:database-offline`,
        system, systemLabel: item.shortName || systemLabel(system), severity: "critical", source: "health",
        title: "Banco Supabase indisponível",
        message: item.database.message,
        occurredAt: item.database.checkedAt || nowIso(),
        active: true,
      });
    }
  }
  return result;
}

function readHistory(): IncidentHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function persistHistory(active: MonitoringIncident[]) {
  const time = nowIso();
  const current = new Map(readHistory().map((item) => [item.id, item]));
  const activeIds = new Set(active.map((item) => item.id));

  for (const incident of active) {
    const previous = current.get(incident.id);
    current.set(incident.id, {
      ...incident,
      firstSeenAt: previous?.firstSeenAt || incident.occurredAt || time,
      lastSeenAt: time,
      occurrences: (previous?.occurrences || 0) + 1,
      resolvedAt: null,
    });
  }

  for (const [id, item] of current) {
    if (!activeIds.has(id) && item.active) {
      current.set(id, { ...item, active: false, resolvedAt: time, lastSeenAt: time });
    }
  }

  const rows = [...current.values()]
    .sort((a,b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .slice(0, 300);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
  return rows;
}

export async function getMonitoringIncidents() {
  const [healthResult, technicalResult, operationalResult] = await Promise.allSettled([
    getSystemHealth(),
    getTechnicalMonitoring(),
    getObservability(),
  ]);

  const incidents: MonitoringIncident[] = [];

  if (healthResult.status === "fulfilled") incidents.push(...healthIncidents(healthResult.value));

  if (technicalResult.status === "fulfilled") {
    for (const system of technicalResult.value.systems) {
      const systemKey = system.key as IncidentSystem;
      for (const issue of system.sentry.issues || []) {
        incidents.push({
          id: `sentry:${system.key}:${issue.id}`,
          system: systemKey,
          systemLabel: system.label,
          severity: ["fatal","error"].includes(String(issue.level).toLowerCase()) ? "critical" : "warning",
          source: "sentry",
          title: issue.title,
          message: `${issue.count} ocorrência(s) · último evento ${issue.lastSeen ? new Date(issue.lastSeen).toLocaleString("pt-BR") : "agora"}`,
          occurredAt: issue.lastSeen || nowIso(),
          actionUrl: issue.permalink,
          active: true,
        });
      }

      for (const deployment of system.vercel.deployments || []) {
        if (!["ERROR","CANCELED"].includes(String(deployment.state).toUpperCase())) continue;
        incidents.push({
          id: `vercel:${system.key}:${deployment.id}`,
          system: systemKey,
          systemLabel: system.label,
          severity: deployment.state === "ERROR" ? "critical" : "warning",
          source: "vercel",
          title: deployment.state === "ERROR" ? "Deploy com erro" : "Deploy cancelado",
          message: deployment.commitMessage || deployment.commitSha || "Falha registrada pela Vercel.",
          occurredAt: deployment.createdAt ? new Date(deployment.createdAt).toISOString() : nowIso(),
          actionUrl: deployment.url,
          active: true,
        });
      }
    }
  }

  if (operationalResult.status === "fulfilled") {
    for (const tenant of operationalResult.value) {
      for (const item of tenant.incidents || []) {
        incidents.push({
          id: `operation:${tenant.tenant}:${item.id}`,
          system: tenant.tenant,
          systemLabel: systemLabel(tenant.tenant),
          severity: item.severity === "critical" ? "critical" : "warning",
          source: "operation",
          title: item.title,
          message: item.message,
          occurredAt: item.occurredAt || nowIso(),
          active: true,
        });
      }
    }
  }

  const unique = [...new Map(incidents.map((item) => [item.id, item])).values()]
    .sort((a,b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity] || new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });

  const localHistory = persistHistory(unique);
  try {
    const centralHistory = await syncCentralIncidents(unique);
    const centralActive = centralHistory.filter((item) => item.active);
    return { active: centralActive, history: centralHistory, storage: "central" as const };
  } catch {
    return { active: unique, history: localHistory, storage: "local" as const };
  }
}

export async function getIncidentHistory() {
  try {
    return await listCentralIncidents();
  } catch {
    return readHistory();
  }
}

export async function acknowledgeIncident(id: string) {
  try {
    await acknowledgeCentralIncident(id);
    return;
  } catch {
    const rows = readHistory().map((item) => item.id === id ? { ...item, acknowledged: true, acknowledgedAt: nowIso() } : item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
  }
}

export async function requestIncidentNotifications() {
  if (!("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  const result = await Notification.requestPermission();
  return result;
}
