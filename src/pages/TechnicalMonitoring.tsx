import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  CloudCog,
  ExternalLink,
  GitCommitHorizontal,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { ActionButton, PageHeader } from "../components/UI";
import { getTechnicalMonitoring, type TechnicalMonitoring, type TechnicalSystem } from "../services/technicalMonitoring";

function formatDateTime(value: string | number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stateTone(state?: string) {
  const value = String(state || "").toUpperCase();
  if (["READY", "ONLINE", "SUCCESS", "SUCCEEDED"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["ERROR", "FAILED", "CANCELED", "OFFLINE"].includes(value)) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  tone?: "blue" | "emerald" | "rose" | "amber";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.08em] text-slate-400">{label}</p>
          <b className="mt-1 block text-2xl font-black text-[#07182d]">{value}</b>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${toneClass}`}>{icon}</span>
      </div>
    </div>
  );
}

function SystemStatusCard({ system }: { system: TechnicalSystem }) {
  const deployment = system.vercel.deployments?.[0] || null;
  const deployState = deployment?.state || system.vercel.current?.state || "Pendente";
  const issueCount = system.sentry.issues?.length || 0;
  const healthy = system.vercel.configured && system.sentry.configured && !system.vercel.error && !system.sentry.error;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-[#f8fbff] p-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Sistema</span>
          <h3 className="mt-1 text-base font-black text-[#07182d]">{system.label}</h3>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${healthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {healthy ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11px] font-black text-[#07182d]"><CloudCog size={15} /> Vercel</span>
            <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${stateTone(deployState)}`}>{deployState}</span>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            {system.vercel.configured ? "Leitura da API configurada." : "Credencial ou projeto pendente."}
          </p>
          {deployment?.commitMessage && <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-slate-600">{deployment.commitMessage}</p>}
          {deployment?.url && (
            <a href={deployment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-blue-700 hover:underline">
              Abrir deploy <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11px] font-black text-[#07182d]"><Bug size={15} /> Sentry</span>
            <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${system.sentry.configured ? issueCount ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {system.sentry.configured ? `${issueCount} aberto(s)` : "Pendente"}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            {system.sentry.configured ? "Issues não resolvidas sendo consultadas." : "Projeto do Sentry ainda não vinculado."}
          </p>
          {system.sentry.error && <p className="mt-1 text-[10px] font-semibold text-rose-600">{system.sentry.error}</p>}
        </div>
      </div>
    </article>
  );
}

export default function TechnicalMonitoring() {
  const [data, setData] = useState<TechnicalMonitoring | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      setData(await getTechnicalMonitoring());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a observabilidade técnica.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const issues = useMemo(
    () => data?.systems.flatMap((system) => system.sentry.issues.map((issue) => ({ ...issue, system: system.label }))) || [],
    [data],
  );

  const deployments = useMemo(
    () => data?.systems.flatMap((system) => system.vercel.deployments.map((deployment) => ({ ...deployment, system: system.label }))) || [],
    [data],
  );

  const readySystems = data?.systems.filter((system) => system.vercel.configured && system.sentry.configured).length || 0;
  const failedDeployments = deployments.filter((deployment) => ["ERROR", "FAILED", "CANCELED"].includes(String(deployment.state).toUpperCase())).length;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-5">
      <PageHeader
        title="Observabilidade técnica"
        subtitle="Painel técnico do MW TECH Control, Gestão Licita RG e Gestão Licita BG: Sentry, Vercel, falhas e deploys."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/monitoramento" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
              <ArrowLeft size={17} /> Voltar
            </Link>
            <ActionButton onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Atualizando..." : "Atualizar"}
            </ActionButton>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#06192d] via-[#0a3155] to-[#0b3d69] p-5 text-white shadow-[0_18px_50px_rgba(6,25,45,.16)] sm:p-6">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/[.07] blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-blue-100">
              <Wrench size={13} /> Central técnica
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Controle técnico em uma tela separada</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Aqui ficam somente informações de infraestrutura e erros. O monitoramento operacional continua limpo e focado em disponibilidade, usuários e uso dos sistemas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4">
              <span className="text-[10px] font-black uppercase tracking-wide text-blue-100">Sentry</span>
              <b className="mt-1 block text-lg font-black">{data?.integrations.sentryConfigured ? "Conectado" : "Pendente"}</b>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4">
              <span className="text-[10px] font-black uppercase tracking-wide text-blue-100">Vercel</span>
              <b className="mt-1 block text-lg font-black">{data?.integrations.vercelConfigured ? "Conectada" : "Limitada"}</b>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sistemas completos" value={loading ? "—" : `${readySystems}/${data?.systems.length || 3}`} hint="Vercel e Sentry vinculados" icon={<ShieldCheck size={19} />} tone="emerald" />
        <MetricCard label="Erros em aberto" value={loading ? "—" : issues.length} hint="Issues não resolvidas no Sentry" icon={<Bug size={19} />} tone={issues.length ? "rose" : "emerald"} />
        <MetricCard label="Deploys com falha" value={loading ? "—" : failedDeployments} hint="Falhas dentro dos deploys retornados" icon={<XCircle size={19} />} tone={failedDeployments ? "rose" : "emerald"} />
        <MetricCard label="Última atualização" value={loading ? "—" : formatDateTime(data?.generatedAt)} hint="Atualização automática a cada 60 segundos" icon={<ServerCog size={19} />} tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {(data?.systems || []).map((system) => <SystemStatusCard key={system.key} system={system} />)}
        {loading && [0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-black text-[#07182d]">Erros técnicos recentes</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Ordenados pelo último evento recebido do Sentry.</p>
            </div>
            <Bug size={18} className="text-rose-500" />
          </div>
          <div className="max-h-[430px] overflow-y-auto">
            {issues.length ? [...issues].sort((a, b) => new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime()).slice(0, 20).map((issue) => (
              <div key={issue.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="truncate text-xs text-[#07182d]">{issue.title}</b>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black text-rose-700">{issue.level || "error"}</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-5 text-slate-500">{issue.system} · {issue.count} ocorrência(s) · {issue.userCount} usuário(s)</p>
                    <p className="text-[10px] text-slate-400">Último evento: {formatDateTime(issue.lastSeen)}</p>
                  </div>
                  {issue.permalink && <a href={issue.permalink} target="_blank" rel="noreferrer" className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"><ExternalLink size={14} /></a>}
                </div>
              </div>
            )) : (
              <div className="px-5 py-12 text-center">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                <b className="mt-3 block text-sm text-[#07182d]">{data?.integrations.sentryConfigured ? "Nenhum erro em aberto" : "Sentry ainda não configurado"}</b>
                <p className="mt-1 text-xs text-slate-500">{data?.integrations.sentryConfigured ? "A consulta atual não retornou issues não resolvidas." : "Configure as variáveis abaixo na Vercel."}</p>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-black text-[#07182d]">Deploys recentes</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Histórico recente dos três projetos.</p>
            </div>
            <GitCommitHorizontal size={18} className="text-blue-700" />
          </div>
          <div className="max-h-[430px] overflow-y-auto divide-y divide-slate-100">
            {deployments.length ? deployments.slice(0, 24).map((deployment) => (
              <div key={deployment.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <b className="block truncate text-xs text-[#07182d]">{deployment.system}</b>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{deployment.commitMessage || deployment.commitRef || "Deploy sem mensagem de commit"}</p>
                    <p className="mt-0.5 text-[9px] text-slate-400">{formatDateTime(deployment.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${stateTone(deployment.state)}`}>{deployment.state}</span>
                </div>
              </div>
            )) : <div className="px-5 py-10 text-center text-xs text-slate-500">Nenhum deploy retornado pela integração.</div>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-200"><ServerCog size={18} /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#07182d]">Configuração necessária para ficar completo</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">As credenciais ficam somente na Vercel e são lidas pelo endpoint interno do MW TECH Control. Nenhum token é enviado ao navegador.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-amber-200 bg-white p-4">
                <b className="text-xs text-[#07182d]">Sentry</b>
                <p className="mt-2 font-mono text-[11px] leading-6 text-slate-600">SENTRY_AUTH_TOKEN<br/>SENTRY_ORG<br/>SENTRY_PROJECT_MW<br/>SENTRY_PROJECT_RG<br/>SENTRY_PROJECT_BG</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white p-4">
                <b className="text-xs text-[#07182d]">Vercel</b>
                <p className="mt-2 font-mono text-[11px] leading-6 text-slate-600">VERCEL_API_TOKEN<br/>VERCEL_TEAM_ID<br/>VERCEL_MW_PROJECT_ID<br/>VERCEL_RG_PROJECT_ID<br/>VERCEL_BG_PROJECT_ID</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
