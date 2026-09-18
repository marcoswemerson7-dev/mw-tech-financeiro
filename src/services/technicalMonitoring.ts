export type TechnicalDeployment = {
  id: string;
  state: string;
  target: string | null;
  url: string | null;
  createdAt: number | string | null;
  commitSha: string | null;
  commitRef: string | null;
  commitMessage: string | null;
};

export type TechnicalIssue = {
  id: string;
  shortId: string | null;
  title: string;
  culprit: string;
  level: string;
  count: number;
  userCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  permalink: string | null;
  status: string;
};

export type TechnicalSystem = {
  key: "mw" | "rg" | "bg";
  label: string;
  vercel: {
    configured: boolean;
    reason?: string;
    error?: string;
    current?: {
      state: string;
      commitSha: string | null;
      commitRef: string | null;
      url: string | null;
    };
    deployments: TechnicalDeployment[];
  };
  sentry: {
    configured: boolean;
    reason?: string;
    error?: string;
    issues: TechnicalIssue[];
  };
};

export type TechnicalMonitoring = {
  ok: boolean;
  systems: TechnicalSystem[];
  summary: { unresolved: number; failedDeploys: number };
  integrations: { sentryConfigured: boolean; vercelConfigured: boolean };
  generatedAt: string;
};

export async function getTechnicalMonitoring(): Promise<TechnicalMonitoring> {
  const response = await fetch("/api/technical-monitoring", { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar a observabilidade técnica.");
  return body as TechnicalMonitoring;
}
