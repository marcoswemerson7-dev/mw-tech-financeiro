import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  ExternalLink,
  FileStack,
  FileText,
  Gauge,
  HardDrive,
  Info,
  Receipt,
  RefreshCw,
  Server,
  ShieldCheck,
  UsersRound,
  Wrench,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ActionButton, PageHeader } from "../components/UI";
import {
  getSystemHealth,
  type HealthState,
  type MonitoringMetrics,
  type SystemHealthSnapshot,
} from "../services/systemMonitoring";

const refreshEveryMs = 60000;
const historyKey = "mw-control:monitoring-history:v2";
const chartColors = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#4f46e5"];

type HistoryPoint = {
  time: string;
  [key: string]: string | number | null;
};

function stateLabel(state: HealthState) {
  if (state === "online") return "Operacional";
  if (state === "attention") return "Atenção";
  if (state === "offline") return "Indisponível";
  if (state === "checking") return "Verificando";
  return "Não configurado";
}

function lastChecked(items: SystemHealthSnapshot[]) {
  const stamps = items
    .flatMap((item) => [item.app.checkedAt, item.database.checkedAt, item.metrics?.checkedAt || ""])
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (!stamps.length) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(Math.max(...stamps)));
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: "blue" | "emerald" | "violet" | "amber" | "slate";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(7,24,45,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(7,24,45,.08)]">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${styles}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-black uppercase tracking-[.08em] text-slate-400">{label}</p>
          <b className="mt-0.5 block text-[25px] font-black leading-none text-[#07182d]">{value}</b>
          <p className="mt-1.5 truncate text-[10px] text-slate-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function SmallRow({
  icon,
  label,
  value,
  good = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2.5 text-[11px] font-semibold text-slate-500">
        <span className="text-slate-400">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <b className={`shrink-0 text-[11px] ${good ? "text-emerald-700" : "text-[#07182d]"}`}>{value}</b>
    </div>
  );
}

function MetricBox({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wide text-slate-400">
        <span className="text-slate-500">{icon}</span>{label}
      </div>
      <b className="mt-1.5 block text-lg font-black text-[#07182d]">{value}</b>
    </div>
  );
}

function getSystemTheme(item: SystemHealthSnapshot) {
  const haystack = `${item.name} ${item.shortName}`.toLowerCase();
  if (item.tenantKey === "bg" || haystack.includes("baixa grande")) {
    return {
      header: "bg-gradient-to-br from-[#061426] via-[#073523] to-[#0b5b38]",
      accent: "bg-emerald-500",
      soft: "bg-emerald-50 text-emerald-700 border-emerald-200",
      button: "bg-emerald-600 hover:bg-emerald-700",
      fallback: "bg-emerald-700",
    };
  }
  if (item.tenantKey === "rg" || haystack.includes("ribeiro gonçalves") || haystack.includes("ribeiro goncalves")) {
    return {
      header: "bg-gradient-to-br from-[#061426] via-[#0b2d5b] to-[#174d8f]",
      accent: "bg-amber-400",
      soft: "bg-blue-50 text-blue-700 border-blue-200",
      button: "bg-blue-600 hover:bg-blue-700",
      fallback: "bg-blue-700",
    };
  }
  return {
    header: "bg-gradient-to-br from-[#07182d] via-[#20364f] to-[#334155]",
    accent: "bg-slate-400",
    soft: "bg-slate-50 text-slate-700 border-slate-200",
    button: "bg-slate-700 hover:bg-slate-800",
    fallback: "bg-slate-700",
  };
}

function SystemCard({ item }: { item: SystemHealthSnapshot }) {
  const m = item.metrics;
  const metricsAvailable = Boolean(m?.configured);
  const theme = getSystemTheme(item);
  const badge = item.tenantKey?.toUpperCase() || item.shortName.slice(0, 2).toUpperCase() || "SI";
  const displayName = item.tenantKey === "rg"
    ? "Gestão Licita RG"
    : item.tenantKey === "bg"
      ? "Gestão Licita BG"
      : (item.shortName || item.name);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_34px_rgba(7,24,45,.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(7,24,45,.12)]">
      <div className={`h-1.5 w-full ${theme.accent}`} />
      <div className={`relative overflow-hidden p-4 text-white ${theme.header}`}>
        <div className="pointer-events-none absolute -right-10 -top-14 size-36 rounded-full bg-white/[.07] blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/25 bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,.18)]">
              {item.logoUrl ? (
                <img src={item.logoUrl} alt={`Logomarca ${item.name}`} className="size-full object-contain" />
              ) : (
                <span className={`grid size-full place-items-center rounded-xl text-xs font-black text-white ${theme.fallback}`}>{badge}</span>
              )}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black">{displayName}</h3>
              <p className="mt-0.5 line-clamp-2 text-[10px] font-medium text-white/75">{item.name}</p>
              <p className="mt-1 truncate text-[9px] text-white/60">{item.accessUrl.replace(/^https?:\/\//, "") || "Domínio não informado"}</p>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-black text-white`}>
            <span className={`size-1.5 rounded-full ${item.overall === "online" ? "bg-emerald-300" : item.overall === "offline" ? "bg-rose-300" : "bg-amber-300"}`} />
            {stateLabel(item.overall)}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <SmallRow icon={<Gauge size={14} />} label="Latência" value={item.app.latencyMs !== null ? `${item.app.latencyMs} ms` : "—"} />
          <SmallRow icon={<Server size={14} />} label="Aplicação / domínio" value={stateLabel(item.app.state)} good={item.app.state === "online"} />
          <SmallRow icon={<Database size={14} />} label="Banco Supabase" value={stateLabel(item.database.state)} good={item.database.state === "online"} />
          <SmallRow icon={<ShieldCheck size={14} />} label="Backend interno" value={stateLabel(item.backend.state)} good={item.backend.state === "online"} />
          <SmallRow icon={<UsersRound size={14} />} label="Usuários cadastrados" value={m?.users ?? "—"} />
          <SmallRow icon={<Activity size={14} />} label="Ativos 24h" value={m?.active24h ?? "—"} />
          <SmallRow icon={<Activity size={14} />} label="Ações 24h" value={m?.audit24h ?? "—"} />
          <SmallRow icon={<Clock3 size={14} />} label="Ativos 7 dias" value={m?.active7d ?? "—"} />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-[11px] font-black text-[#07182d]">Volume operacional</h4>
              <p className="text-[9px] text-slate-400">Dados reais cadastrados no sistema.</p>
            </div>
            {!metricsAvailable && <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-700">Integração de métricas pendente</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricBox label="Processos" value={m?.processes ?? "—"} icon={<FileStack size={12} />} />
            <MetricBox label="Contratos" value={m?.contracts ?? "—"} icon={<FileText size={12} />} />
            <MetricBox label="Notas fiscais" value={m?.invoices ?? "—"} icon={<Receipt size={12} />} />
            <MetricBox label="Pagamentos" value={m?.payments ?? "—"} icon={<CreditCard size={12} />} />
            <MetricBox label="Arquivos" value={m?.files ?? "—"} icon={<HardDrive size={12} />} />
            <MetricBox label={item.tenantKey === "bg" ? "Arquivos no Drive" : "Arquivos no sistema"} value={formatBytes(m?.fileBytes)} icon={<HardDrive size={12} />} />
            <MetricBox label="Banco Supabase" value={formatBytes(m?.databaseBytes)} icon={<Database size={12} />} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.accessUrl && <a href={item.accessUrl} target="_blank" rel="noreferrer" className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black text-white transition ${theme.button}`}>Abrir sistema <ExternalLink size={12} /></a>}
          {item.tenantKey && <Link to={`/monitoramento/usuarios?tenant=${item.tenantKey}`} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${theme.soft}`}><UsersRound size={12} /> Usuários</Link>}
        </div>
      </div>
    </article>
  );
}

function sumMetric(items: SystemHealthSnapshot[], key: keyof MonitoringMetrics) {
  return items.reduce((sum, item) => sum + Number(item.metrics?.[key] || 0), 0);
}

export default function Monitoring() {
  const [items, setItems] = useState<SystemHealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [nextRefresh, setNextRefresh] = useState(refreshEveryMs / 1000);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const data = await getSystemHealth();
      setItems(data);
      setNextRefresh(refreshEveryMs / 1000);

      const point: HistoryPoint = {
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      data.forEach((item) => {
        point[item.key] = item.app.latencyMs;
      });
      setHistory((current) => {
        const next = [...current, point].slice(-24);
        localStorage.setItem(historyKey, JSON.stringify(next));
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o monitoramento.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || "[]") as HistoryPoint[];
      if (Array.isArray(saved)) setHistory(saved.slice(-24));
    } catch {
      setHistory([]);
    }

    void load();
    const refreshId = window.setInterval(() => void load(), refreshEveryMs);
    const timerId = window.setInterval(() => setNextRefresh((current) => current <= 1 ? refreshEveryMs / 1000 : current - 1), 1000);
    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(timerId);
    };
  }, [load]);

  const summary = useMemo(() => {
    const online = items.filter((item) => item.overall === "online").length;
    const attention = items.filter((item) => item.overall === "attention").length;
    const offline = items.filter((item) => item.overall === "offline").length;
    const latencies = items.map((item) => item.app.latencyMs).filter((value): value is number => value !== null);
    const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    return {
      online,
      attention,
      offline,
      average,
      users: sumMetric(items, "users"),
      activeUsers: sumMetric(items, "activeUsers"),
      processes: sumMetric(items, "processes"),
      contracts: sumMetric(items, "contracts"),
      invoices: sumMetric(items, "invoices"),
      payments: sumMetric(items, "payments"),
      files: sumMetric(items, "files"),
    };
  }, [items]);

  const alerts = useMemo(() => {
    const rows: Array<{ title: string; detail: string; level: "Alta" | "Média" | "Info"; tone: string }> = [];
    items.forEach((item) => {
      if (item.overall === "offline") rows.push({ title: "Sistema indisponível", detail: item.name, level: "Alta", tone: "rose" });
      else if (item.overall === "attention") rows.push({ title: "Sistema requer atenção", detail: item.name, level: "Média", tone: "amber" });
      if ((item.app.latencyMs || 0) > 2500) rows.push({ title: "Latência elevada", detail: `${item.name} · ${item.app.latencyMs} ms`, level: "Média", tone: "amber" });
      if (!item.metrics?.configured) rows.push({ title: "Métricas detalhadas pendentes", detail: item.name, level: "Info", tone: "blue" });
    });
    if (!rows.length) rows.push({ title: "Nenhuma pendência crítica", detail: "Todos os sistemas monitorados estão estáveis.", level: "Info", tone: "blue" });
    return rows.slice(0, 6);
  }, [items]);

  const distribution = [
    { name: "Operacionais", value: summary.online },
    { name: "Em atenção", value: summary.attention },
    { name: "Indisponíveis", value: summary.offline },
  ];

  const totalSystems = items.length;
  const operationalPercent = totalSystems ? Math.round((summary.online / totalSystems) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4">
      <PageHeader
        title="Monitoramento dos sistemas"
        subtitle="Visão consolidada dos sistemas dos órgãos atendidos pela MW TECH."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/sistemas" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-[#082743] shadow-sm transition hover:border-blue-200 hover:bg-blue-50">
              <FileStack size={17} /> Sistemas e órgãos
            </Link>
            <Link to="/monitoramento/tecnico" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-[#082743] shadow-sm transition hover:border-blue-200 hover:bg-blue-50">
              <Wrench size={17} /> Observabilidade técnica
            </Link>
            <ActionButton onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Atualizando..." : "Atualizar agora"}
            </ActionButton>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <SummaryCard label="Sistemas operacionais" value={loading ? "—" : `${summary.online}/${items.length}`} hint={summary.offline ? `${summary.offline} indisponível` : summary.attention ? `${summary.attention} em atenção` : "Todos em operação"} icon={<ShieldCheck size={20} />} tone="blue" />
        <SummaryCard label="Usuários cadastrados" value={loading ? "—" : String(summary.users)} hint={`${summary.activeUsers} habilitados`} icon={<UsersRound size={20} />} tone="emerald" />
        <SummaryCard label="Processos" value={loading ? "—" : String(summary.processes)} hint="Total cadastrado" icon={<FileStack size={20} />} tone="violet" />
        <SummaryCard label="Contratos" value={loading ? "—" : String(summary.contracts)} hint="Total cadastrado" icon={<FileText size={20} />} tone="slate" />
        <SummaryCard label="Notas fiscais" value={loading ? "—" : String(summary.invoices)} hint="Total cadastrado" icon={<Receipt size={20} />} tone="amber" />
        <SummaryCard label="Pagamentos" value={loading ? "—" : String(summary.payments)} hint="Registros financeiros" icon={<CreditCard size={20} />} tone="emerald" />
        <SummaryCard label="Arquivos" value={loading ? "—" : String(summary.files)} hint="Arquivos registrados" icon={<HardDrive size={20} />} tone="violet" />
        <SummaryCard label="Latência média" value={loading || summary.average === null ? "—" : `${summary.average} ms`} hint="Tempo médio de resposta" icon={<Gauge size={20} />} tone="amber" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-[#07182d]"><HardDrive size={17} className="text-violet-700" /> Armazenamento por origem</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">Separação entre banco de dados e arquivos registrados em cada sistema.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-600">Atualizado junto com o monitoramento</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const metrics = item.metrics;
            const source = item.tenantKey === "bg" ? "Google Drive · arquivos registrados" : "Supabase · arquivos registrados";
            return (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="truncate text-[11px] font-black text-[#07182d]">{item.shortName || item.name}</b>
                  <HardDrive size={14} className="shrink-0 text-violet-600" />
                </div>
                <p className="mt-1 text-[9px] text-slate-500">{source}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="block text-[9px] font-bold uppercase text-slate-400">Arquivos</span><b className="text-sm text-[#07182d]">{formatBytes(metrics?.fileBytes)}</b></div>
                  <div><span className="block text-[9px] font-bold uppercase text-slate-400">Banco Supabase</span><b className="text-sm text-[#07182d]">{formatBytes(metrics?.databaseBytes)}</b></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
          <span className="flex items-center gap-2 font-black text-emerald-800"><span className="size-2 rounded-full bg-emerald-500" /> Monitoramento automático ativo</span>
          <span className="text-emerald-700">Última atualização: <b>{lastChecked(items)}</b></span>
          <span className="flex items-center gap-1.5 text-emerald-700"><Clock3 size={13} /> Próxima atualização em <b>{nextRefresh}s</b></span>
        </div>
        <span className="flex items-center gap-2 text-[11px] font-black text-emerald-800"><CheckCircle2 size={15} /> {items.length} sistema(s) monitorado(s)</span>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-[#07182d]"><Activity size={18} className="text-blue-700" /> Saúde e dados dos sistemas</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Somente os órgãos cadastrados em “Sistemas e órgãos”. Novos clientes entram automaticamente neste painel.</p>
            </div>
            <Link to="/sistemas" className="text-[10px] font-black text-blue-700">Gerenciar sistemas</Link>
          </div>

          {loading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="h-[470px] animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : items.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => <SystemCard key={item.key} item={item} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <b className="text-sm text-[#07182d]">Nenhum sistema cadastrado para monitoramento.</b>
              <p className="mt-1 text-xs text-slate-500">Adicione o órgão em “Sistemas e órgãos”.</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-[#07182d]"><Bell size={17} className="text-rose-500" /> Alertas e pendências</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Eventos que precisam de atenção.</p>
            </div>
            <span className="text-[10px] font-black text-blue-700">Atual</span>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.map((alert, index) => {
              const palette = alert.tone === "rose" ? "bg-rose-50 text-rose-700" : alert.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
              return (
                <div key={index} className="flex items-center gap-3 py-3.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full ${palette}`}>
                    {alert.tone === "blue" ? <Info size={15} /> : <AlertTriangle size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[11px] text-[#07182d]">{alert.title}</b>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{alert.detail}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black ${palette}`}>{alert.level}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_420px_350px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-[#07182d]">Histórico de latência</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">Cada linha representa um sistema cadastrado.</p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600">Últimas 24 leituras</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {items.map((item, index) => (
                  <Line key={item.key} type="monotone" dataKey={item.key} name={item.shortName || item.name} stroke={chartColors[index % chartColors.length]} strokeWidth={2.2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-[#07182d]">Distribuição operacional</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Situação de todos os sistemas cadastrados.</p>
          <div className="mt-2 grid grid-cols-[170px_1fr] items-center gap-3">
            <div className="relative h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270}>
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><b className="block text-xl font-black text-[#07182d]">{operationalPercent}%</b><span className="text-[9px] text-slate-500">Operacionais</span></div>
              </div>
            </div>
            <div className="space-y-3 text-[10px]">
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full bg-emerald-500" /> Operacionais</span><b>{summary.online}</b></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full bg-amber-500" /> Em atenção</span><b>{summary.attention}</b></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full bg-rose-500" /> Indisponíveis</span><b>{summary.offline}</b></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-[#07182d]"><Zap size={17} className="text-amber-500" /> Acesso rápido</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">Atalhos administrativos.</p>
          </div>
          <div className="mt-4 space-y-2.5">
            <Link to="/sistemas" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
              <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><FileStack size={17} /></span>
              <div className="min-w-0 flex-1"><b className="block text-[11px] text-[#07182d]">Sistemas e órgãos</b><p className="truncate text-[9px] text-slate-500">Adicionar ou editar clientes</p></div>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link to="/monitoramento/usuarios" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
              <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><UsersRound size={17} /></span>
              <div className="min-w-0 flex-1"><b className="block text-[11px] text-[#07182d]">Ver usuários</b><p className="truncate text-[9px] text-slate-500">Usuários dos sistemas integrados</p></div>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link to="/monitoramento/tecnico" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-amber-200 hover:bg-amber-50/50">
              <span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Wrench size={17} /></span>
              <div className="min-w-0 flex-1"><b className="block text-[11px] text-[#07182d]">Observabilidade técnica</b><p className="truncate text-[9px] text-slate-500">Sentry, deploys e integrações</p></div>
              <ExternalLink size={14} className="text-slate-400" />
            </Link>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Info size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-black text-[#07182d]">Como funciona este painel</h3>
          <p className="mt-1 text-[10px] leading-5 text-slate-600">
            O painel lê automaticamente os órgãos cadastrados em “Sistemas e órgãos”. Para RG e BG, as métricas detalhadas de processos, contratos, notas, pagamentos, arquivos e usuários já são consultadas. Novos órgãos entram automaticamente no monitoramento de domínio e banco; as métricas detalhadas passam a aparecer assim que a integração de dados do novo cliente for configurada.
          </p>
        </div>
      </section>
    </div>
  );
}
