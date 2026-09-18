import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileStack,
  Gauge,
  Info,
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
  type SystemHealthSnapshot,
} from "../services/systemMonitoring";

const refreshEveryMs = 60000;
const historyKey = "mw-control:monitoring-history";

type HistoryPoint = {
  time: string;
  mw: number | null;
  rg: number | null;
  bg: number | null;
};

function stateLabel(state: HealthState) {
  if (state === "online") return "Operacional";
  if (state === "attention") return "Atenção";
  if (state === "offline") return "Indisponível";
  if (state === "checking") return "Verificando";
  return "Não configurado";
}

function stateClasses(state: HealthState) {
  if (state === "online") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "attention") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "offline") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
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
  tone: "blue" | "emerald" | "violet" | "amber";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(7,24,45,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(7,24,45,.08)]">
      <div className="flex items-center gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${styles}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[.08em] text-slate-400">{label}</p>
          <b className="mt-0.5 block text-[28px] font-black leading-none text-[#07182d]">{value}</b>
          <p className="mt-1.5 truncate text-[11px] text-slate-500">{hint}</p>
        </div>
        <span className="grid size-8 place-items-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-700">
          <ArrowRight size={15} />
        </span>
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
  value: string;
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

function MiniBars({ active = true }: { active?: boolean }) {
  const heights = active ? [8, 15, 11, 20, 13, 18, 9] : [5, 5, 5, 5, 5, 5, 5];
  return (
    <span className="flex h-6 items-end gap-0.5">
      {heights.map((height, index) => (
        <span key={index} className="w-1 rounded-full bg-blue-400" style={{ height }} />
      ))}
    </span>
  );
}

function SystemCard({ item }: { item: SystemHealthSnapshot }) {
  const latency = item.app.latencyMs;
  const activeUsers = item.metrics?.activeUsers ?? item.metrics?.users ?? null;
  const activity = item.metrics?.audit24h ?? item.metrics?.active24h ?? null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-black text-white ${item.key === "rg" ? "bg-blue-600" : "bg-violet-600"}`}>
            {item.key.toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-[#07182d]">Gestão Licita {item.key.toUpperCase()}</h3>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">{item.accessUrl.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black ${stateClasses(item.overall)}`}>
          <span className={`size-1.5 rounded-full ${item.overall === "online" ? "bg-emerald-500" : item.overall === "offline" ? "bg-rose-500" : "bg-amber-500"}`} />
          {stateLabel(item.overall)}
        </span>
      </div>

      <div className="mt-4">
        <SmallRow icon={<Gauge size={14} />} label="Latência média" value={latency !== null ? `${latency} ms` : "—"} />
        <SmallRow icon={<Server size={14} />} label="Aplicação / domínio" value={stateLabel(item.app.state)} good={item.app.state === "online"} />
        <SmallRow icon={<Database size={14} />} label="Banco Supabase" value={stateLabel(item.database.state)} good={item.database.state === "online"} />
        <SmallRow icon={<UsersRound size={14} />} label="Usuários ativos" value={activeUsers === null ? "—" : String(activeUsers)} />
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500">
            <Activity size={14} className="text-slate-400" /> Atividade (24h)
          </span>
          <div className="flex items-center gap-2">
            <MiniBars active={Boolean(activity)} />
            <b className="text-[10px] text-emerald-700">{activity === null ? "Sem leitura" : "Normal"}</b>
          </div>
        </div>
      </div>

      <a href={item.accessUrl} target="_blank" rel="noreferrer" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[11px] font-black text-blue-700 transition hover:bg-blue-100">
        Abrir sistema <ExternalLink size={12} />
      </a>
    </article>
  );
}

function MwCard() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#07182d] p-1.5">
            <img src="/mw-tech-logo.png" alt="MW TECH" className="size-full object-contain" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-[#07182d]">MW TECH Control</h3>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">{window.location.host}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Operacional
        </span>
      </div>

      <div className="mt-4">
        <SmallRow icon={<Gauge size={14} />} label="Painel atual" value="Online" good />
        <SmallRow icon={<Server size={14} />} label="Aplicação" value="Carregada" good />
        <SmallRow icon={<ShieldCheck size={14} />} label="Sessão autenticada" value="Ativa" good />
        <SmallRow icon={<UsersRound size={14} />} label="Usuários ativos" value="—" />
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500">
            <Activity size={14} className="text-slate-400" /> Atividade
          </span>
          <div className="flex items-center gap-2"><MiniBars /><b className="text-[10px] text-emerald-700">Normal</b></div>
        </div>
      </div>

      <Link to="/" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[11px] font-black text-blue-700 transition hover:bg-blue-100">
        Abrir início <ArrowRight size={12} />
      </Link>
    </article>
  );
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

      const rg = data.find((item) => item.key === "rg")?.app.latencyMs ?? null;
      const bg = data.find((item) => item.key === "bg")?.app.latencyMs ?? null;
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const mw = navigation?.duration ? Math.round(navigation.duration) : null;
      const point: HistoryPoint = {
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        mw,
        rg,
        bg,
      };
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
    const online = items.filter((item) => item.overall === "online").length + 1;
    const attention = items.filter((item) => item.overall === "attention").length;
    const offline = items.filter((item) => item.overall === "offline").length;
    const latencies = items.map((item) => item.app.latencyMs).filter((value): value is number => value !== null);
    const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    const activeUsers = items.reduce((sum, item) => sum + Number(item.metrics?.activeUsers || item.metrics?.users || 0), 0);
    const processes = items.reduce((sum, item) => sum + Number(item.metrics?.processes || 0), 0);
    return { online, attention, offline, average, activeUsers, processes };
  }, [items]);

  const alerts = useMemo(() => {
    const rows: Array<{ title: string; detail: string; level: "Alta" | "Média" | "Info"; tone: string }> = [];
    items.forEach((item) => {
      if (item.overall === "offline") rows.push({ title: "Sistema indisponível", detail: `Gestão Licita ${item.key.toUpperCase()}`, level: "Alta", tone: "rose" });
      else if (item.overall === "attention") rows.push({ title: "Sistema requer atenção", detail: `Gestão Licita ${item.key.toUpperCase()}`, level: "Média", tone: "amber" });
      if ((item.app.latencyMs || 0) > 2500) rows.push({ title: "Latência elevada detectada", detail: `Gestão Licita ${item.key.toUpperCase()} · ${item.app.latencyMs} ms`, level: "Média", tone: "amber" });
    });
    if (!rows.length) rows.push({ title: "Nenhuma pendência crítica", detail: "Todos os sistemas monitorados estão estáveis.", level: "Info", tone: "blue" });
    return rows.slice(0, 5);
  }, [items]);

  const distribution = [
    { name: "Operacionais", value: summary.online },
    { name: "Em atenção", value: summary.attention },
    { name: "Indisponíveis", value: summary.offline },
  ];

  const totalSystems = 3;
  const operationalPercent = totalSystems ? Math.round((summary.online / totalSystems) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4">
      <PageHeader
        title="Monitoramento dos sistemas"
        subtitle="Visão geral operacional de RG, BG e MW TECH Control."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Sistemas operacionais" value={loading ? "—" : `${summary.online}/3`} hint={summary.offline ? `${summary.offline} indisponível` : summary.attention ? `${summary.attention} em atenção` : "Todos em operação"} icon={<ShieldCheck size={22} />} tone="blue" />
        <SummaryCard label="Usuários ativos" value={loading ? "—" : String(summary.activeUsers)} hint="Usuários habilitados em RG + BG" icon={<UsersRound size={22} />} tone="emerald" />
        <SummaryCard label="Processos monitorados" value={loading ? "—" : String(summary.processes)} hint="Volume atual em RG + BG" icon={<FileStack size={22} />} tone="violet" />
        <SummaryCard label="Latência média" value={loading || summary.average === null ? "—" : `${summary.average} ms`} hint={summary.average !== null && summary.average <= 800 ? "Resposta dentro do esperado" : "Acompanhar tempo de resposta"} icon={<Gauge size={22} />} tone="amber" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
          <span className="flex items-center gap-2 font-black text-emerald-800"><span className="size-2 rounded-full bg-emerald-500" /> Monitoramento automático ativo</span>
          <span className="text-emerald-700">Última atualização: <b>{lastChecked(items)}</b></span>
          <span className="flex items-center gap-1.5 text-emerald-700"><Clock3 size={13} /> Próxima atualização em <b>{nextRefresh}s</b></span>
        </div>
        <span className="flex items-center gap-2 text-[11px] font-black text-emerald-800"><CheckCircle2 size={15} /> Todos os sistemas sendo monitorados</span>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-[#07182d]"><Activity size={18} className="text-blue-700" /> Saúde dos sistemas</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Status em tempo real dos sistemas e principais indicadores.</p>
            </div>
            <span className="text-[10px] font-black text-blue-700">Visão consolidada</span>
          </div>

          {loading ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-[330px] animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              <MwCard />
              {items.map((item) => <SystemCard key={item.key} item={item} />)}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-[#07182d]"><Bell size={17} className="text-rose-500" /> Alertas e pendências</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Eventos que requerem atenção.</p>
            </div>
            <span className="text-[10px] font-black text-blue-700">Atual</span>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.map((alert, index) => {
              const palette = alert.tone === "rose" ? "bg-rose-50 text-rose-700" : alert.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
              return (
                <div key={index} className="flex items-center gap-3 py-3.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full ${palette}`}>
                    {alert.tone === "rose" ? <AlertTriangle size={15} /> : alert.tone === "amber" ? <AlertTriangle size={15} /> : <Info size={15} />}
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
              <h3 className="text-sm font-black text-[#07182d]">Atividade dos sistemas</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">Histórico de latência coletado durante o monitoramento.</p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600">Últimas leituras</span>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="mw" name="MW TECH Control" stroke="#0b2b66" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="rg" name="Gestão Licita RG" stroke="#2563eb" strokeWidth={2.2} dot={false} connectNulls />
                <Line type="monotone" dataKey="bg" name="Gestão Licita BG" stroke="#7c3aed" strokeWidth={2.2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-[#07182d]">Distribuição operacional</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Situação consolidada dos três sistemas.</p>
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
            <p className="mt-0.5 text-[10px] text-slate-500">Links para as ações mais comuns.</p>
          </div>
          <div className="mt-4 space-y-2.5">
            <Link to="/monitoramento/usuarios" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
              <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><UsersRound size={17} /></span>
              <div className="min-w-0 flex-1"><b className="block text-[11px] text-[#07182d]">Ver usuários</b><p className="truncate text-[9px] text-slate-500">Acessar lista de usuários</p></div>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link to="/sistemas" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
              <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-700"><FileStack size={17} /></span>
              <div className="min-w-0 flex-1"><b className="block text-[11px] text-[#07182d]">Ver detalhes</b><p className="truncate text-[9px] text-slate-500">Sistemas e integrações</p></div>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link to="/monitoramento/tecnico" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
              <span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Wrench size={17} /></span>
              <div className="min-w-0 flex-1"><b className="block text-[11px] text-[#07182d]">Abrir observabilidade técnica</b><p className="truncate text-[9px] text-slate-500">Erros, deploys e integrações</p></div>
              <ExternalLink size={14} className="text-slate-400" />
            </Link>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Info size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-black text-[#07182d]">Como interpretar o painel</h3>
          <p className="mt-1 text-[10px] leading-5 text-slate-600">
            Este painel mostra o status operacional do MW TECH Control, Gestão Licita RG e Gestão Licita BG. “Operacional” indica que os serviços monitorados estão respondendo normalmente. A latência representa o tempo médio de resposta; em caso de problemas, consulte os alertas e abra a observabilidade técnica.
          </p>
        </div>
        <Link to="/monitoramento/tecnico" className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-black text-blue-700">Observabilidade técnica <ExternalLink size={12} /></Link>
      </section>
    </div>
  );
}
