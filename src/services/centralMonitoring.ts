import { ID } from "appwrite";
import { appwriteConfig, functions } from "../lib/appwrite";
import type { MonitoringIncident, IncidentHistoryItem } from "./incidents";

export type MonthlyAvailabilityRow = {
  system: "mw" | "rg" | "bg";
  incidents: number;
  criticalIncidents: number;
  downtimeMinutes: number;
  availability: number;
};

async function execute(action: string, payload: Record<string, unknown> = {}) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Função administrativa não configurada.");
  const execution = await functions.createExecution({
    functionId: appwriteConfig.financialFunctionId,
    body: JSON.stringify({ action, idempotencyKey: ID.unique(), ...payload }),
    async: false,
  });
  let body: Record<string, any> = {};
  try { body = execution.responseBody ? JSON.parse(execution.responseBody) : {}; } catch { body = {}; }
  if (execution.status !== "completed" || body.error) {
    const executionError = String((execution as unknown as { errors?: string }).errors || "").trim();
    throw new Error(body.error || executionError || "Operação de monitoramento não concluída.");
  }
  return body;
}

function normalize(row: any): IncidentHistoryItem {
  return {
    id: String(row.incident_key || row.id || row.$id || ""),
    system: row.system,
    systemLabel: row.system_label || row.systemLabel || "",
    severity: row.severity,
    source: row.source,
    title: row.title || "",
    message: row.message || "",
    occurredAt: row.first_seen_at || row.occurredAt || new Date().toISOString(),
    actionUrl: row.action_url || row.actionUrl || null,
    active: Boolean(row.active),
    firstSeenAt: row.first_seen_at || row.firstSeenAt || new Date().toISOString(),
    lastSeenAt: row.last_seen_at || row.lastSeenAt || new Date().toISOString(),
    occurrences: Number(row.occurrences || 1),
    resolvedAt: row.resolved_at || row.resolvedAt || null,
    acknowledged: Boolean(row.acknowledged),
    acknowledgedAt: row.acknowledged_at || null,
    acknowledgedBy: row.acknowledged_by || "",
  };
}

export async function syncCentralIncidents(incidents: MonitoringIncident[]) {
  const body = await execute("syncIncidents", { incidents });
  return (body.rows || []).map(normalize) as IncidentHistoryItem[];
}

export async function listCentralIncidents() {
  const body = await execute("listIncidents");
  return (body.rows || []).map(normalize) as IncidentHistoryItem[];
}

export async function acknowledgeCentralIncident(incidentKey: string) {
  await execute("acknowledgeIncident", { incidentKey });
}

export async function getMonthlyAvailability(month: string) {
  const body = await execute("monthlyAvailability", { month });
  return {
    month: String(body.month || month),
    periodMinutes: Number(body.periodMinutes || 0),
    systems: (body.systems || []) as MonthlyAvailabilityRow[],
  };
}
