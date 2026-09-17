import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Gauge,
  RefreshCw,
  Server,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { ActionButton, PageHeader } from "../components/UI";
import {
  getSystemHealth,
  type EndpointHealth,
  type HealthState,
  type SystemHealthSnapshot,
} from "../services/systemMonitoring";

const refreshEveryMs = 60000;

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

function dotClasses(state: HealthState) {
  if (state === "online") return "bg-emerald-500";
  if (state === "attention") return "bg-amber-500";
  if (state === "offline") return "bg-rose-500";
  return "bg-slate-400";
}

function iconFor(state: HealthState) {
  if (state === "online") return CheckCircle2;
  if (state === "offline") return WifiOff;
  return AlertTriangle;
}

function lastChecked(items: SystemHealthSnapshot[]) {
  const stamps = items
    .flatMap((item) => [item.app.checkedAt, item.database.checkedAt])
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (!stamps.length) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(Math.max(...stamps)));
}

function EndpointRow({
  icon,
  title,
  health,
}: {
  icon: ReactNode;
  title: string;
  health: EndpointHealth;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#0b355d] shadow-sm ring-1 ring-slate-200">
          {icon}
        </span>
        <div className="min-w-0">
          <b className="block text-sm text-[#07182d]">{title}</b>
          <p className="mt-0.5 truncate text-xs text-slate-500">{health.message}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${stateClasses(health.state)}`}>
          <span className={`size-2 rounded-full ${dotClasses(health.state)}`} />
          {stateLabel(health.state)}
        </span>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          {health.latencyMs !== null ? `${health.latencyMs} ms` : "sem leitura"}
        </p>
      </div>
    </div>
  );
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const mb = value / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</span>
    <b className="mt-1 block text-xl font-black text-[#07182d]">{value}</b>
  </div>;
}

function SystemCard({ item }: { item: SystemHealthSnapshot }) {
  const StatusIcon = iconFor(item.overall);
  const isBg = item.key === "bg";
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(7,24,45,.08)]">
      <div className={`relative overflow-hidden p-6 text-white ${isBg ? "bg-gradient-to-br from-[#07192c] via-[#0a3a29] to-[#0d6240]" : "bg-gradient-to-br from-[#07192c] via-[#0b315b] to-[#165493]"}`}>
        <div className="absolute -right-12 -top-14 size-44 rounded-full bg-white/[.07] blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-white/60">Gestão Licita</p>
            <h2 className="mt-2 text-xl font-black leading-tight">{item.shortName}</h2>
            <p className="mt-1 text-sm text-white/70">{item.city}</p>
          </div>
          <span className={`grid size-12 place-items-center rounded-2xl border border-white/15 ${item.overall === "online" ? "bg-emerald-400/15 text-emerald-200" : item.overall === "offline" ? "bg-rose-400/15 text-rose-200" : "bg-amber-300/15 text-amber-100"}`}>
            <StatusIcon size={24} />
          </span>
        </div>
        <div className="relative mt-5 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3 py-1.5 text-xs font-black">
            <span className={`size-2 rounded-full ${dotClasses(item.overall)}`} />
            {stateLabel(item.overall)}
          </span>
          {item.accessUrl && (
            <a href={item.accessUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white">
              Abrir sistema <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <div className="space-y-3 p-5">
        <EndpointRow icon={<Server size={19} />} title="Aplicação / domínio" health={item.app} />
        <EndpointRow icon={<Database size={19} />} title="Banco Supabase" health={item.database} />

        {item.metrics?.configured ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricBox label="Processos" value={item.metrics.processes ?? "—"} />
          <MetricBox label="Usuários cadastrados" value={item.metrics.users ?? "—"} />
          <MetricBox label="Ativos em 24h" value={item.metrics.active24h ?? "—"} />
          <MetricBox label="Banco de dados" value={formatBytes(item.metrics.databaseBytes)} />
          <MetricBox label="Notas fiscais" value={item.metrics.invoices ?? "—"} />
          <MetricBox label="Pagamentos" value={item.metrics.payments ?? "—"} />
          <MetricBox label="Ações em 24h" value={item.metrics.audit24h ?? "—"} />
          <MetricBox label="Atualização" value={item.metrics.checkedAt ? new Date(item.metrics.checkedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "—"} />
        </div> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Métricas detalhadas aguardando as credenciais seguras do Supabase na Vercel.
        </div>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
              <Gauge size={15} /> Resposta da aplicação
            </span>
            <b className="mt-2 block text-2xl font-black text-[#07182d]">
              {item.app.latencyMs !== null ? `${item.app.latencyMs} ms` : "—"}
            </b>
            <p className="mt-1 text-xs text-slate-500">Leitura feita pelo MW TECH Control.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
              <ShieldCheck size={15} /> Vercel
            </span>
            <b className="mt-2 block text-sm font-black text-[#07182d]">
              {item.vercelUrl ? "Projeto vinculado" : "Link não cadastrado"}
            </b>
            {item.vercelUrl ? (
              <a href={item.vercelUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
                Abrir projeto <ExternalLink size={13} />
              </a>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Cadastre o link em Sistemas e órgãos.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Monitoring() {
  const [items, setItems] = useState<SystemHealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [nextRefresh, setNextRefresh] = useState(refreshEveryMs / 1000);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const data = await getSystemHealth();
      setItems(data);
      setNextRefresh(refreshEveryMs / 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o monitoramento.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
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
    const latencies = items.flatMap((item) => [item.app.latencyMs, item.database.latencyMs]).filter((value): value is number => value !== null);
    const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    return { online, attention, offline, average };
  }, [items]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Monitoramento dos sistemas"
        subtitle="Acompanhe em tempo real a disponibilidade do Gestão Licita de Ribeiro Gonçalves e Baixa Grande do Ribeiro."
        actions={
          <ActionButton onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando..." : "Atualizar agora"}
          </ActionButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Sistemas operacionais" value={loading ? "—" : String(summary.online)} icon={<CheckCircle2 size={21} />} tone="emerald" />
        <SummaryCard label="Precisam de atenção" value={loading ? "—" : String(summary.attention)} icon={<AlertTriangle size={21} />} tone="amber" />
        <SummaryCard label="Indisponíveis" value={loading ? "—" : String(summary.offline)} icon={<WifiOff size={21} />} tone="rose" />
        <SummaryCard label="Resposta média" value={loading || summary.average === null ? "—" : `${summary.average} ms`} icon={<Activity size={21} />} tone="blue" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Clock3 size={19} /></span>
          <div>
            <b className="block text-sm text-[#07182d]">Monitoramento automático ativo</b>
            <p className="text-xs text-slate-500">Nova verificação a cada 60 segundos · próxima em {nextRefresh}s</p>
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-400">Última leitura: {lastChecked(items)}</p>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-[510px] animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />)}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {items.map((item) => <SystemCard key={item.key} item={item} />)}
        </div>
      )}

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <h3 className="text-sm font-black text-[#07182d]">O que este painel verifica</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          O MW TECH Control testa a disponibilidade do domínio do sistema e do endpoint do Supabase e mede o tempo de resposta.
          Nenhuma senha, service role ou token administrativo fica exposto no navegador. Métricas internas de Vercel e logs avançados
          poderão ser adicionados depois por uma função de backend segura.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "emerald" | "amber" | "rose" | "blue";
}) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
          <b className="mt-2 block text-3xl font-black text-[#07182d]">{value}</b>
        </div>
        <span className={`grid size-11 place-items-center rounded-xl ring-1 ${styles}`}>{icon}</span>
      </div>
    </div>
  );
}
