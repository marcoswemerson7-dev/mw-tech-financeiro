import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  MemoryStick,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type ServiceState = "online" | "offline" | "unknown";

type VpsTelemetry = {
  configured?: boolean;
  reachable?: boolean;
  latencyMs?: number | null;
  statusCode?: number | null;
  hostname?: string;
  os?: string;
  kernel?: string;
  uptimeSeconds?: number | null;
  cpuPercent?: number | null;
  cpuCores?: number | null;
  cpuModel?: string;
  memoryUsedBytes?: number | null;
  memoryTotalBytes?: number | null;
  memoryPercent?: number | null;
  swapUsedBytes?: number | null;
  swapTotalBytes?: number | null;
  swapPercent?: number | null;
  diskUsedBytes?: number | null;
  diskTotalBytes?: number | null;
  diskPercent?: number | null;
  diskFreeBytes?: number | null;
  load1?: number | null;
  load5?: number | null;
  load15?: number | null;
  docker?: ServiceState;
  caddy?: ServiceState;
  nginx?: ServiceState;
  postgres?: ServiceState;
  app?: ServiceState;
  containersRunning?: number | null;
  containersTotal?: number | null;
  processCount?: number | null;
  networkRxBytes?: number | null;
  networkTxBytes?: number | null;
  sslValid?: boolean | null;
  sslExpiresAt?: string | null;
  publicIp?: string;
  version?: string;
  checkedAt?: string;
  message?: string;
};

const EMPTY: VpsTelemetry = {};

function formatBytes(value?: number | null, compact = false) {
  if (value === null || value === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const decimals = compact ? (n >= 100 ? 0 : n >= 10 ? 1 : 2) : (i >= 3 ? 1 : 0);
  return `${n.toFixed(decimals)} ${units[i]}`;
}

function formatUptime(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function pct(value?: number | null) {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

function clampPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function toneForPercent(value?: number | null) {
  const n = Number(value ?? 0);
  if (n >= 90) return {
    text: "text-rose-700",
    soft: "bg-rose-50",
    bar: "bg-rose-500",
    ring: "ring-rose-100",
  };
  if (n >= 75) return {
    text: "text-amber-700",
    soft: "bg-amber-50",
    bar: "bg-amber-500",
    ring: "ring-amber-100",
  };
  return {
    text: "text-blue-700",
    soft: "bg-blue-50",
    bar: "bg-blue-500",
    ring: "ring-blue-100",
  };
}

function Service({ label, state }: { label: string; state?: ServiceState }) {
  const online = state === "online";
  const offline = state === "offline";
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <span className="truncate pr-2 text-[10px] font-bold text-slate-600">{label}</span>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-black ${
          online
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
            : offline
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
              : "bg-slate-100 text-slate-500"
        }`}
      >
        <span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : offline ? "bg-rose-500" : "bg-slate-400"}`} />
        {online ? "Online" : offline ? "Offline" : "Sem dado"}
      </span>
    </div>
  );
}

function ResourceMetric({
  label,
  value,
  detail,
  percent,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  percent?: number | null;
  icon: React.ReactNode;
}) {
  const tone = toneForPercent(percent);
  const hasProgress = percent !== undefined && percent !== null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_20px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,.07)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${hasProgress ? tone.soft : "bg-slate-50"} ${hasProgress ? tone.text : "text-slate-600"}`}>
            {icon}
          </span>
          <span className="truncate text-[9px] font-black uppercase tracking-[.08em] text-slate-400">{label}</span>
        </div>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <b className={`min-w-0 truncate text-[19px] font-black leading-none ${hasProgress ? tone.text : "text-[#07182d]"}`}>{value}</b>
        {detail && <span className="shrink-0 text-right text-[8px] font-semibold text-slate-400">{detail}</span>}
      </div>
      {hasProgress && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${clampPercent(percent)}%` }} />
        </div>
      )}
    </div>
  );
}

function SimpleMetric({
  label,
  value,
  detail,
  icon,
  wide = false,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_20px_rgba(15,23,42,.04)] ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
        <span className="truncate text-[9px] font-black uppercase tracking-[.08em] text-slate-400">{label}</span>
      </div>
      <b className={`mt-2.5 block font-black leading-tight text-[#07182d] ${wide ? "text-[13px]" : "text-[18px]"}`}>{value}</b>
      {detail && <p className="mt-1 text-[8px] font-semibold text-slate-400">{detail}</p>}
    </div>
  );
}

function HeaderStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[.07] px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.08em] text-white/55">{icon}{label}</div>
      <b className="mt-1 block truncate text-[11px] font-black text-white">{value}</b>
    </div>
  );
}

export default function VpsServerPanel() {
  const [data, setData] = useState<VpsTelemetry>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/vps-monitoring", { cache: "no-store" });
        const body = await response.json();
        if (active) setData(body || EMPTY);
      } catch (error) {
        if (active) {
          setData({
            configured: true,
            reachable: false,
            message: error instanceof Error ? error.message : "Falha ao consultar VPS.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const checkedAtLabel = useMemo(() => {
    if (!data.checkedAt) return "Sem coleta";
    const date = new Date(data.checkedAt);
    if (Number.isNaN(date.getTime())) return "Sem coleta";
    return date.toLocaleString("pt-BR");
  }, [data.checkedAt]);

  if (loading) {
    return <div className="mt-4 h-[520px] animate-pulse rounded-3xl border border-slate-200 bg-slate-50" />;
  }

  if (!data.configured) {
    return (
      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-200">
            <TriangleAlert size={17} />
          </span>
          <div>
            <h4 className="text-[12px] font-black text-[#07182d]">Telemetria completa da VPS</h4>
            <p className="mt-1 text-[10px] leading-5 text-slate-600">
              Painel preparado. Falta apenas conectar o endpoint seguro da VPS para receber CPU, RAM, disco, uptime e serviços em tempo real.
            </p>
            <p className="mt-2 font-mono text-[9px] text-slate-500">VPS_TEST_HEALTH_URL · VPS_TEST_HEALTH_TOKEN</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-[#f8fafc] shadow-[0_18px_48px_rgba(7,24,45,.10)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#061426] via-[#0b2f52] to-[#174d8f] px-4 py-4 text-white sm:px-5">
        <div className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 size-28 rounded-full bg-violet-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-lg backdrop-blur">
              <Server size={23} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[14px] font-black tracking-tight">Telemetria VPS</h4>
                <span className="rounded-full bg-blue-400/15 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-blue-100 ring-1 ring-inset ring-blue-200/20">TESTE</span>
              </div>
              <p className="mt-1 truncate text-[10px] font-semibold text-white/70">
                {data.hostname || "Servidor de teste"}{data.publicIp ? ` · ${data.publicIp}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ${data.reachable ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/20" : "bg-rose-400/15 text-rose-100 ring-1 ring-rose-300/20"}`}>
                  {data.reachable ? <CheckCircle2 size={11} /> : <TriangleAlert size={11} />}
                  {data.reachable ? "Servidor online" : "Servidor sem resposta"}
                </span>
                <span className="text-[9px] font-semibold text-white/55">Atualização automática a cada 60s</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
            <HeaderStat label="Sistema" value={data.os || "Ubuntu"} icon={<Server size={10} />} />
            <HeaderStat label="Kernel" value={data.kernel || "—"} icon={<ShieldCheck size={10} />} />
            <HeaderStat label="Uptime" value={formatUptime(data.uptimeSeconds)} icon={<Activity size={10} />} />
            <HeaderStat label="Última coleta" value={checkedAtLabel} icon={<Gauge size={10} />} />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h5 className="flex items-center gap-2 text-[12px] font-black text-[#07182d]">
                <Activity size={15} className="text-violet-700" />
                Recursos e desempenho
              </h5>
              <p className="mt-0.5 text-[9px] font-medium text-slate-400">Métricas em tempo real exclusivas do ambiente VPS de teste.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-100">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Coleta ativa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <ResourceMetric
              label="CPU"
              value={pct(data.cpuPercent)}
              detail={data.cpuCores != null ? `${data.cpuCores} núcleo(s)` : undefined}
              percent={data.cpuPercent}
              icon={<Cpu size={14} />}
            />
            <ResourceMetric
              label="Memória RAM"
              value={pct(data.memoryPercent)}
              detail={data.memoryTotalBytes != null ? `${formatBytes(data.memoryUsedBytes, true)} / ${formatBytes(data.memoryTotalBytes, true)}` : undefined}
              percent={data.memoryPercent}
              icon={<MemoryStick size={14} />}
            />
            <ResourceMetric
              label="Swap"
              value={pct(data.swapPercent)}
              detail={data.swapTotalBytes != null ? `${formatBytes(data.swapUsedBytes, true)} / ${formatBytes(data.swapTotalBytes, true)}` : undefined}
              percent={data.swapPercent}
              icon={<MemoryStick size={14} />}
            />
            <ResourceMetric
              label="Disco"
              value={pct(data.diskPercent)}
              detail={data.diskTotalBytes != null ? `${formatBytes(data.diskUsedBytes, true)} / ${formatBytes(data.diskTotalBytes, true)}` : undefined}
              percent={data.diskPercent}
              icon={<HardDrive size={14} />}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <SimpleMetric label="Disco livre" value={formatBytes(data.diskFreeBytes, true)} icon={<HardDrive size={14} />} />
          <SimpleMetric label="Uptime" value={formatUptime(data.uptimeSeconds)} icon={<Activity size={14} />} />
          <SimpleMetric label="Latência health" value={data.latencyMs != null ? `${data.latencyMs} ms` : "—"} icon={<Gauge size={14} />} />
          <SimpleMetric label="Load 1 minuto" value={data.load1 != null ? data.load1.toFixed(2) : "—"} icon={<Activity size={14} />} />
          <SimpleMetric label="Load 5 minutos" value={data.load5 != null ? data.load5.toFixed(2) : "—"} icon={<Activity size={14} />} />
          <SimpleMetric label="Load 15 minutos" value={data.load15 != null ? data.load15.toFixed(2) : "—"} icon={<Activity size={14} />} />
          <SimpleMetric label="Processos" value={data.processCount != null ? String(data.processCount) : "—"} icon={<Activity size={14} />} />
          <SimpleMetric
            label="Containers"
            value={data.containersTotal != null ? `${data.containersRunning ?? 0}/${data.containersTotal}` : "—"}
            detail="ativos / total"
            icon={<Server size={14} />}
          />
          <SimpleMetric label="Rede recebida" value={formatBytes(data.networkRxBytes, true)} detail="acumulado desde o boot" icon={<Activity size={14} />} />
          <SimpleMetric label="Rede enviada" value={formatBytes(data.networkTxBytes, true)} detail="acumulado desde o boot" icon={<Activity size={14} />} />
          <SimpleMetric label="Modelo da CPU" value={data.cpuModel || "—"} icon={<Cpu size={14} />} wide />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h5 className="flex items-center gap-2 text-[11px] font-black text-[#07182d]">
                <ShieldCheck size={14} className="text-emerald-700" />
                Estado dos serviços
              </h5>
              <p className="mt-0.5 text-[8px] text-slate-400">Saúde dos principais serviços do servidor.</p>
            </div>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Tempo real</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Service label="Aplicação" state={data.app} />
            <Service label="Docker" state={data.docker} />
            <Service label="Caddy" state={data.caddy || data.nginx} />
            <Service label="PostgreSQL" state={data.postgres} />
            <Service label="Health Endpoint" state={data.reachable ? "online" : "offline"} />
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-wider text-slate-400"><Database size={12} />Endpoint</div>
            <b className="mt-1.5 block text-[11px] text-[#07182d]">{data.statusCode ? `HTTP ${data.statusCode}` : "—"}{data.version ? ` · agente ${data.version}` : ""}</b>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-wider text-slate-400"><ShieldCheck size={12} />SSL</div>
            <b className={`mt-1.5 block text-[11px] ${data.sslValid === true ? "text-emerald-700" : data.sslValid === false ? "text-rose-700" : "text-slate-500"}`}>
              {data.sslValid === true ? "Válido" : data.sslValid === false ? "Inválido / expirado" : "Não aplicável / sem dado"}
            </b>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-wider text-slate-400"><Server size={12} />IP público</div>
            <b className="mt-1.5 block text-[11px] text-[#07182d]">{data.publicIp || "—"}</b>
          </div>
        </div>

        {data.message && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800">
            {data.message}
          </p>
        )}
      </div>
    </section>
  );
}
