import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Filter,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  ExternalLink,
  FileStack,
  FileText,
  FolderOpen,
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
import { getCachedDriveStorageUsage, getDriveStorageUsage, type DriveStorageUsage } from "../services/googleDrive";

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

function GoogleDriveLogo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} role="img" aria-label="Google Drive">
      <path d="M6.6 65.8 27.8 29h21.3L27.9 65.8H6.6Z" fill="#0F9D58" />
      <path d="M59.4 65.8H27.9L49.1 29h31.6L59.4 65.8Z" fill="#4285F4" />
      <path d="M38.5 0 59.7 36.8 49.1 55.2 17.3 0h21.2Z" fill="#F4B400" />
    </svg>
  );
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

function systemFilterLabel(item: SystemHealthSnapshot) {
  if (item.tenantKey === "rg") return "Gestão Licita RG — Ribeiro Gonçalves";
  if (item.tenantKey === "bg") return "Gestão Licita BG — Baixa Grande do Ribeiro";
  return item.shortName || item.name || "Órgão monitorado";
}

function systemChartLabel(item: SystemHealthSnapshot) {
  if (item.tenantKey === "rg") return "Gestão Licita RG";
  if (item.tenantKey === "bg") return "Gestão Licita BG";
  return item.shortName || item.name || "Sistema";
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
  const displayName = systemChartLabel(item);

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
            <MetricBox label="Arquivos registrados" value={m?.files ?? "—"} icon={<HardDrive size={12} />} />
            <MetricBox label="Volume dos anexos" value={formatBytes(m?.fileBytes)} icon={<HardDrive size={12} />} />
            <MetricBox label="Arquivos no Supabase" value={m?.supabaseStorageFiles ?? "—"} icon={<HardDrive size={12} />} />
            <MetricBox label="Storage Supabase" value={formatBytes(m?.supabaseStorageBytes)} icon={<HardDrive size={12} />} />
            <MetricBox label="Banco Supabase" value={formatBytes(m?.databaseBytes)} icon={<Database size={12} />} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.accessUrl && <a href={item.accessUrl} target="_blank" rel="noreferrer" className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black text-white transition ${theme.button}`}>Abrir sistema <ExternalLink size={12} /></a>}
          {item.tenantKey && <Link to={`/monitoramento/usuarios?tenant=${encodeURIComponent(item.tenantKey)}`} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${theme.soft}`}><UsersRound size={12} /> Usuários</Link>}
          {item.tenantKey && <Link to={`/monitoramento/auditoria?system=${encodeURIComponent(item.tenantKey)}&name=${encodeURIComponent(item.name)}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"><ShieldCheck size={12} /> Auditoria</Link>}
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
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [orgFilter, setOrgFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | HealthState>("todos");
  const [driveData, setDriveData] = useState<DriveStorageUsage | null>(() => getCachedDriveStorageUsage());
  const [driveError, setDriveError] = useState("");

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesOrg = orgFilter === "todos" || item.key === orgFilter;
    const matchesStatus = statusFilter === "todos" || item.overall === statusFilter;
    return matchesOrg && matchesStatus;
  }), [items, orgFilter, statusFilter]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const data = await getSystemHealth();
      setItems(data);
      setDriveError("");
      void getDriveStorageUsage(manual)
        .then(setDriveData)
        .catch((driveErr: Error) => setDriveError(driveErr.message));
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

  useEffect(() => {
    if (!selectedKey && visibleItems.length) setSelectedKey(visibleItems[0].key);
    if (selectedKey && !visibleItems.some((item) => item.key === selectedKey)) setSelectedKey(visibleItems[0]?.key || "");
  }, [visibleItems, selectedKey]);

  const selectedItem = useMemo(() => visibleItems.find((item) => item.key === selectedKey) || visibleItems[0] || null, [visibleItems, selectedKey]);

  const summary = useMemo(() => {
    const online = visibleItems.filter((item) => item.overall === "online").length;
    const attention = visibleItems.filter((item) => item.overall === "attention").length;
    const offline = visibleItems.filter((item) => item.overall === "offline").length;
    const latencies = visibleItems.map((item) => item.app.latencyMs).filter((value): value is number => value !== null);
    const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    return {
      online,
      attention,
      offline,
      average,
      users: sumMetric(visibleItems, "users"),
      activeUsers: sumMetric(visibleItems, "activeUsers"),
      processes: sumMetric(visibleItems, "processes"),
      contracts: sumMetric(visibleItems, "contracts"),
      invoices: sumMetric(visibleItems, "invoices"),
      payments: sumMetric(visibleItems, "payments"),
      files: sumMetric(visibleItems, "files"),
    };
  }, [visibleItems]);

  const alerts = useMemo(() => {
    const rows: Array<{ title: string; detail: string; level: "Alta" | "Média" | "Info"; tone: string }> = [];
    visibleItems.forEach((item) => {
      if (item.overall === "offline") rows.push({ title: "Sistema indisponível", detail: item.name, level: "Alta", tone: "rose" });
      else if (item.overall === "attention") rows.push({ title: "Sistema requer atenção", detail: item.name, level: "Média", tone: "amber" });
      if ((item.app.latencyMs || 0) > 2500) rows.push({ title: "Latência elevada", detail: `${item.name} · ${item.app.latencyMs} ms`, level: "Média", tone: "amber" });
      if (!item.metrics?.configured) rows.push({ title: "Métricas detalhadas pendentes", detail: item.name, level: "Info", tone: "blue" });
    });
    if (!rows.length) rows.push({ title: "Nenhuma pendência crítica", detail: "Todos os sistemas monitorados estão estáveis.", level: "Info", tone: "blue" });
    return rows.slice(0, 6);
  }, [visibleItems]);

  const distribution = [
    { name: "Operacionais", value: summary.online },
    { name: "Em atenção", value: summary.attention },
    { name: "Indisponíveis", value: summary.offline },
  ];

  const totalSystems = visibleItems.length;
  const operationalPercent = totalSystems ? Math.round((summary.online / totalSystems) * 100) : 0;

  const latencyStats = useMemo(() => {
    const keys = new Set(visibleItems.map((item) => item.key));
    const values = history.flatMap((point) =>
      Object.entries(point)
        .filter(([key]) => key !== "time" && keys.has(key))
        .map(([, value]) => typeof value === "number" ? value : null)
        .filter((value): value is number => value !== null),
    );
    return {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : summary.average,
    };
  }, [history, visibleItems, summary.average]);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
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

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(7,24,45,.04)]">
        <div className="mr-2 flex items-center gap-2 text-sm font-black text-[#07182d]"><span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><Filter size={16} /></span> Filtros do monitoramento</div>
        <select value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)} className="min-w-[175px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">
          <option value="todos">Todos os órgãos</option>
          {items.map((item) => <option key={item.key} value={item.key}>{systemFilterLabel(item)}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "todos" | HealthState)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400">
          <option value="todos">Todos os status</option><option value="online">Operacionais</option><option value="attention">Em atenção</option><option value="offline">Indisponíveis</option>
        </select>
        {(orgFilter !== "todos" || statusFilter !== "todos") && <button type="button" onClick={() => { setOrgFilter("todos"); setStatusFilter("todos"); }} className="rounded-xl px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">Limpar filtros</button>}
        <span className="ml-auto flex items-center gap-2 text-[10px] font-semibold text-slate-500"><span className="size-2 rounded-full bg-emerald-500" /> Atualização automática a cada 60 segundos</span>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_42px_rgba(7,24,45,.07)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white via-blue-50/40 to-amber-50/30 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Gauge size={21} /></span>
            <div>
              <h2 className="text-lg font-black text-[#07182d]">Histórico de latência</h2>
              <p className="text-[11px] text-slate-500">Acompanhamento em tempo real · últimas 24 leituras</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">Atual: {summary.average === null ? "—" : `${summary.average} ms`}</span>
            <span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700">Mín: {latencyStats.min === null ? "—" : `${latencyStats.min} ms`}</span>
            <span className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-700">Média: {latencyStats.average === null ? "—" : `${latencyStats.average} ms`}</span>
            <span className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700">Máx: {latencyStats.max === null ? "—" : `${latencyStats.max} ms`}</span>
          </div>
        </div>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} width={45} axisLine={false} tickLine={false} unit=" ms" />
                <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(7,24,45,.10)" }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                {items.map((item, index) => (
                  <Line key={item.key} type="monotone" dataKey={item.key} name={systemChartLabel(item)} stroke={chartColors[index % chartColors.length]} strokeWidth={2.8} dot={false} activeDot={{ r: 5 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center gap-3">
              <span className={`grid size-11 place-items-center rounded-full ${summary.offline ? "bg-rose-100 text-rose-700" : summary.attention ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}><CheckCircle2 size={22} /></span>
              <div>
                <b className="text-sm text-[#07182d]">{summary.offline ? "Há sistema indisponível" : summary.attention ? "Sistema requer atenção" : "Sistemas estáveis"}</b>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Atualização automática a cada 60 segundos.</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[9px] font-bold uppercase text-slate-400">Latência média</span><b className="mt-1 block text-lg font-black text-[#07182d]">{summary.average === null ? "—" : `${summary.average} ms`}</b></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[9px] font-bold uppercase text-slate-400">Operacionais</span><b className="mt-1 block text-lg font-black text-emerald-700">{operationalPercent}%</b></div>
            </div>
            <p className="mt-4 text-[10px] text-slate-500">Última verificação: <b className="text-slate-700">{lastChecked(items)}</b></p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Sistemas operacionais" value={loading ? "—" : `${summary.online}/${items.length}`} hint={summary.offline ? `${summary.offline} indisponível` : summary.attention ? `${summary.attention} em atenção` : "Todos em operação"} icon={<ShieldCheck size={20} />} tone="blue" />
        <SummaryCard label="Usuários cadastrados" value={loading ? "—" : String(summary.users)} hint={`${summary.activeUsers} habilitados`} icon={<UsersRound size={20} />} tone="emerald" />
        <SummaryCard label="Processos" value={loading ? "—" : String(summary.processes)} hint="Total cadastrado" icon={<FileStack size={20} />} tone="violet" />
        <SummaryCard label="Contratos" value={loading ? "—" : String(summary.contracts)} hint="Total cadastrado" icon={<FileText size={20} />} tone="slate" />
        <SummaryCard label="Notas fiscais" value={loading ? "—" : String(summary.invoices)} hint="Total cadastrado" icon={<Receipt size={20} />} tone="amber" />
        <SummaryCard label="Pagamentos" value={loading ? "—" : String(summary.payments)} hint="Registros financeiros" icon={<CreditCard size={20} />} tone="emerald" />
        <SummaryCard label="Arquivos" value={loading ? "—" : String(summary.files)} hint="Arquivos registrados" icon={<HardDrive size={20} />} tone="violet" />
        <SummaryCard label="Latência média" value={loading || summary.average === null ? "—" : `${summary.average} ms`} hint="Tempo médio de resposta" icon={<Gauge size={20} />} tone="amber" />
      </div>

      <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-[0_12px_34px_rgba(7,24,45,.05)]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <GoogleDriveLogo className="size-8" />
            </span>
            <div>
              <h2 className="text-base font-black text-[#07182d]">Google Drive</h2>
              <p className="text-[10px] text-slate-500">Uso total e consumo das pastas monitoradas por órgão.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black ${driveError ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><span className={`size-2 rounded-full ${driveError ? "bg-amber-500" : "bg-emerald-500"}`} />{driveError ? "Dados em cache" : "Conectado"}</span>
            <Link to="/armazenamento" className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-50">Ver detalhes <ArrowRight size={12}/></Link>
          </div>
        </div>
        {driveData ? (
          <div className="grid gap-3 xl:grid-cols-[1.1fr_.7fr_.7fr_1.6fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-400">Uso total do Drive</span><b className="text-sm text-blue-700">{driveData.percent.toFixed(1)}%</b></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, driveData.percent)}%` }} /></div>
              <div className="mt-3 flex items-end justify-between"><div><b className="text-xl font-black text-[#07182d]">{driveData.usedGb.toFixed(2)} GB</b><p className="text-[9px] text-slate-500">de {driveData.totalGb.toFixed(0)} GB</p></div><span className="text-[9px] text-slate-400">Atualizado {new Date(driveData.updatedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><HardDrive size={17}/></span><p className="mt-3 text-[9px] font-black uppercase text-slate-400">Disponível</p><b className="mt-1 block text-lg font-black text-[#07182d]">{driveData.availableGb.toFixed(2)} GB</b></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Database size={17}/></span><p className="mt-3 text-[9px] font-black uppercase text-slate-400">Plano</p><b className="mt-1 block text-lg font-black text-[#07182d]">{driveData.totalGb.toFixed(0)} GB</b><p className="text-[9px] text-slate-500">{driveData.folders.length} pasta(s) raiz</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between"><b className="text-[11px] text-[#07182d]">Uso por órgão</b><span className="text-[9px] font-semibold text-slate-400">{driveData.folders.length} monitorado(s)</span></div>
              <div className="space-y-3">
                {driveData.folders.slice(0,4).map((folder) => (
                  <div key={folder.id}>
                    <div className="mb-1 flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2 text-[10px] font-semibold text-slate-600"><FolderOpen size={13} className="shrink-0 text-amber-500"/><span className="truncate">{folder.name}</span></span><b className="shrink-0 text-[10px] text-[#07182d]">{folder.usedGb.toFixed(2)} GB</b></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(100, folder.percentOfTotal)}%`}}/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">{driveError || "Carregando dados do Google Drive..."}</div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-6 shadow-[0_14px_40px_rgba(7,24,45,.07)]">
        <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="relative mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg shadow-blue-200">
              <HardDrive size={21} />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#07182d]">Armazenamento por origem</h2>
              <p className="mt-1 text-[11px] text-slate-500">Acompanhe o espaço utilizado e a quantidade de arquivos em cada camada.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-[10px] font-black text-blue-700 shadow-sm">
            <ShieldCheck size={13} /> {visibleItems.length} órgão(s) monitorado(s)
          </span>
        </div>
        <div className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-violet-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Database size={18} /></span>
              <span className="text-[9px] font-black uppercase tracking-wider text-violet-500">Dados</span>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Banco de dados</p>
            <b className="mt-1 block text-2xl font-black tracking-tight text-[#07182d]">{formatBytes(visibleItems.reduce((sum, item) => sum + Number(item.metrics?.databaseBytes || 0), 0))}</b>
            <p className="mt-1 text-[10px] text-slate-500">Supabase Database</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><HardDrive size={18} /></span>
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-500">Arquivos</span>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Storage de arquivos</p>
            <b className="mt-1 block text-xl font-black text-[#07182d]">{formatBytes(visibleItems.reduce((sum, item) => sum + Number(item.metrics?.supabaseStorageBytes || 0), 0))}</b>
            <p className="mt-1 text-[10px] text-slate-500">Arquivos hospedados no Supabase</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileStack size={18} /></span>
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Quantidade</span>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Arquivos registrados</p>
            <b className="mt-1 block text-xl font-black text-[#07182d]">{String(visibleItems.reduce((sum, item) => sum + Number(item.metrics?.supabaseStorageFiles || 0), 0))}</b>
            <p className="mt-1 text-[10px] text-slate-500">Total no Storage Supabase</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Server size={18} /></span>
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-600">Ativos</span>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Órgãos monitorados</p>
            <b className="mt-1 block text-xl font-black text-[#07182d]">{String(visibleItems.length)}</b>
            <p className="mt-1 text-[10px] text-slate-500">Prefeituras e câmaras cadastradas</p>
          </div>
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
            <div className="grid gap-4 xl:grid-cols-3">
              {[0, 1].map((item) => <div key={item} className="h-[470px] animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : items.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map((item) => {
                  const selected = item.key === selectedItem?.key;
                  return (
                    <button key={item.key} type="button" onClick={() => setSelectedKey(item.key)} className={selected ? "text-left rounded-2xl border border-blue-500 bg-blue-50 p-3 shadow-md ring-2 ring-blue-100 transition" : "text-left rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/40"}>
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1">
                          {item.logoUrl ? <img src={item.logoUrl} alt="" className="size-full object-contain" /> : <span className="text-[10px] font-black text-blue-700">{item.tenantKey?.toUpperCase() || "ORG"}</span>}
                        </span>
                        <span className="min-w-0">
                          <b className="block truncate text-xs text-[#07182d]">{item.name}</b>
                          <span className="mt-0.5 block truncate text-[9px] text-slate-500">Sistema monitorado</span>
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[9px] font-bold">
                        <span className={item.overall === "online" ? "text-emerald-700" : item.overall === "offline" ? "text-rose-700" : "text-amber-700"}>{stateLabel(item.overall)}</span>
                        <span className="text-blue-700">{selected ? "Detalhes abertos" : "Clique para abrir →"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedItem && <div className="mx-auto mt-4 w-full max-w-3xl"><SystemCard item={selectedItem} /></div>}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <b className="text-sm text-[#07182d]">Nenhum sistema cadastrado para monitoramento.</b>
              <p className="mt-1 text-xs text-slate-500">Adicione o órgão em “Sistemas e órgãos”.</p>
            </div>
          )}
        </section>

        <section className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <section className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
