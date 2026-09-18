type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type TechnicalTarget = "mw" | "rg" | "bg";

const targets: Array<{ key: TechnicalTarget; label: string; projectId?: string; sentryProject?: string }> = [
  {
    key: "mw",
    label: "MW TECH Control",
    projectId: process.env.VERCEL_MW_PROJECT_ID || process.env.VERCEL_PROJECT_ID || "prj_B6QqV2WOuFXiw1g14aWfvAfCvmc8",
    sentryProject: process.env.SENTRY_PROJECT_MW || process.env.SENTRY_PROJECT,
  },
  {
    key: "rg",
    label: "Gestão Licita RG",
    projectId: process.env.VERCEL_RG_PROJECT_ID,
    sentryProject: process.env.SENTRY_PROJECT_RG,
  },
  {
    key: "bg",
    label: "Gestão Licita BG",
    projectId: process.env.VERCEL_BG_PROJECT_ID,
    sentryProject: process.env.SENTRY_PROJECT_BG,
  },
];

async function getVercelDeployments(projectId?: string) {
  const token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
  if (!projectId) {
    return { configured: false, reason: "project_id_missing", deployments: [] as unknown[] };
  }
  if (!token) {
    return {
      configured: false,
      reason: "token_missing",
      deployments: [],
      current: {
        state: process.env.VERCEL_ENV === "production" ? "READY" : "UNKNOWN",
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
        url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      },
    };
  }

  const teamId = process.env.VERCEL_TEAM_ID || "team_LUui6DFWMWSjCg8I9WQunijT";
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("limit", "10");
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return { configured: true, error: `Vercel HTTP ${response.status}`, deployments: [] as unknown[] };
  }

  const body = await response.json();
  return {
    configured: true,
    deployments: (body.deployments || []).map((item: any) => ({
      id: item.uid || item.id,
      state: item.state || item.readyState || "UNKNOWN",
      target: item.target || null,
      url: item.url ? `https://${item.url}` : null,
      createdAt: item.createdAt || item.created || null,
      commitSha: item.meta?.githubCommitSha || null,
      commitRef: item.meta?.githubCommitRef || null,
      commitMessage: item.meta?.githubCommitMessage || null,
    })),
  };
}

async function getSentryIssues(project?: string) {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  if (!project || !org || !token) {
    return {
      configured: false,
      reason: !token ? "token_missing" : !org ? "org_missing" : "project_missing",
      issues: [] as unknown[],
    };
  }

  const url = new URL(`https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`);
  url.searchParams.set("query", "is:unresolved");
  url.searchParams.set("limit", "20");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return { configured: true, error: `Sentry HTTP ${response.status}`, issues: [] as unknown[] };
  }

  const body = await response.json();
  return {
    configured: true,
    issues: (Array.isArray(body) ? body : []).map((item: any) => ({
      id: item.id,
      shortId: item.shortId || null,
      title: item.title || item.culprit || "Erro sem título",
      culprit: item.culprit || "",
      level: item.level || "error",
      count: Number(item.count || 0),
      userCount: Number(item.userCount || 0),
      firstSeen: item.firstSeen || null,
      lastSeen: item.lastSeen || null,
      permalink: item.permalink || null,
      status: item.status || "unresolved",
    })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  try {
    const systems = await Promise.all(targets.map(async (target) => {
      const [vercel, sentry] = await Promise.all([
        getVercelDeployments(target.projectId),
        getSentryIssues(target.sentryProject),
      ]);
      return { key: target.key, label: target.label, vercel, sentry };
    }));

    const unresolved = systems.reduce((sum, item) => sum + Number((item.sentry as any).issues?.length || 0), 0);
    const failedDeploys = systems.reduce((sum, item) => sum + Number(((item.vercel as any).deployments || []).filter((deployment: any) => ["ERROR", "CANCELED"].includes(String(deployment.state).toUpperCase())).length), 0);

    res.status(200).json({
      ok: true,
      systems,
      summary: { unresolved, failedDeploys },
      integrations: {
        sentryConfigured: Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG),
        vercelConfigured: Boolean(process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao carregar observabilidade técnica." });
  }
}
