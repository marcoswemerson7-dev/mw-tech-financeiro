import { account } from "../lib/appwrite";

export type ObservabilityTenant = "rg" | "bg";

export type ObservabilityUser = {
  id: string;
  tenant: ObservabilityTenant;
  name: string;
  email: string;
  phone: string;
  cpfMasked: string;
  sector: string;
  function: string;
  fiscalSecretaria: string;
  role: string;
  status: string;
  photoUrl: string;
  notes: string;
  mustChangePassword: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  actions24h: number;
  actions7d: number;
  lastActionAt: string | null;
  lastAction: { type: string; module: string; description: string } | null;
};

export type ObservabilityIncident = {
  id: string;
  tenant: ObservabilityTenant;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  context: string;
  occurredAt: string | null;
};

export type ObservabilityPayload = {
  tenant: ObservabilityTenant;
  users: ObservabilityUser[];
  incidents: ObservabilityIncident[];
  summary: {
    users: number;
    activeUsers: number;
    recent24h: number;
    incidents: number;
  };
  generatedAt: string;
};

const ENDPOINTS: Record<ObservabilityTenant, string> = {
  rg: "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-control-observability",
  bg: "https://jfzavijlkbqzkrnlgphz.supabase.co/functions/v1/mw-control-observability",
};

async function getJwt() {
  const result = await account.createJWT();
  if (!result.jwt) throw new Error("Não foi possível autenticar a consulta administrativa.");
  return result.jwt;
}

async function fetchTenant(tenant: ObservabilityTenant, jwt: string): Promise<ObservabilityPayload> {
  const response = await fetch(ENDPOINTS[tenant], {
    method: "GET",
    cache: "no-store",
    headers: { "x-appwrite-jwt": jwt },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Falha ao carregar ${tenant.toUpperCase()}.`);
  return {
    tenant,
    users: (body.users || []).map((user: ObservabilityUser) => ({ ...user, tenant })),
    incidents: (body.incidents || []).map((incident: ObservabilityIncident) => ({ ...incident, tenant })),
    summary: body.summary || { users: 0, activeUsers: 0, recent24h: 0, incidents: 0 },
    generatedAt: body.generatedAt || new Date().toISOString(),
  };
}

export async function getObservability(tenant?: ObservabilityTenant) {
  const jwt = await getJwt();
  if (tenant) return [await fetchTenant(tenant, jwt)];
  const results = await Promise.allSettled([
    fetchTenant("rg", jwt),
    fetchTenant("bg", jwt),
  ]);
  const ok = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!ok.length) {
    const error = results.find((result) => result.status === "rejected");
    throw new Error(error && error.status === "rejected" ? String(error.reason?.message || error.reason) : "Falha ao carregar observabilidade.");
  }
  return ok;
}


const ADMIN_ENDPOINTS: Record<ObservabilityTenant, string> = {
  rg: "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-control-user-admin",
  bg: "https://jfzavijlkbqzkrnlgphz.supabase.co/functions/v1/mw-control-user-admin",
};

async function adminAction(tenant: ObservabilityTenant, payload: Record<string, unknown>) {
  const jwt = await getJwt();
  const response = await fetch(ADMIN_ENDPOINTS[tenant], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-appwrite-jwt": jwt,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a ação administrativa.");
  return body;
}

export async function createManagedSystemUser(tenant: ObservabilityTenant, values: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: string;
  phone?: string;
  sector?: string;
  functionName?: string;
  fiscalSecretaria?: string;
  cpf?: string;
  notes?: string;
}) {
  return adminAction(tenant, { action: "create_user", ...values });
}

export async function updateManagedSystemUser(tenant: ObservabilityTenant, userId: string, values: {
  fullName: string;
  role: string;
  phone?: string;
  sector?: string;
  functionName?: string;
  fiscalSecretaria?: string;
  notes?: string;
}) {
  return adminAction(tenant, { action: "update_user", userId, ...values });
}

export async function setManagedSystemUserStatus(
  tenant: ObservabilityTenant,
  userId: string,
  status: "Ativo" | "Inativo" | "Suspenso",
) {
  return adminAction(tenant, { action: "set_status", userId, status });
}

export async function forceManagedSystemUserPasswordChange(tenant: ObservabilityTenant, userId: string) {
  return adminAction(tenant, { action: "force_password_change", userId });
}
