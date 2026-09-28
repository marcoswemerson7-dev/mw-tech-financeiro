import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Cpu, Database, Gauge, HardDrive, MemoryStick, Server, ShieldCheck, TriangleAlert } from "lucide-react";

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
  docker?: "online" | "offline" | "unknown";
  caddy?: "online" | "offline" | "unknown";
  nginx?: "online" | "offline" | "unknown";
  postgres?: "online" | "offline" | "unknown";
  app?: "online" | "offline" | "unknown";
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

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i >= 3 ? 1 : 0)} ${units[i]}`;
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

function Service({ label, state }: { label: string; state?: "online" | "offline" | "unknown" }) {
  const online = state === "online";
  const offline = state === "offline";
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-[11px] font-bold text-slate-600">{label}</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-black ${online ? "bg-emerald-50 text-emerald-700" : offline ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
        <span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : offline ? "bg-rose-500" : "bg-slate-400"}`} />
        {online ? "Online" : offline ? "Offline" : "Sem dado"}
      </span>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wide text-slate-400">{icon}{label}</div>
      <b className="mt-1.5 block text-base font-black text-[#07182d]">{value}</b>
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
        if (active) setData({ configured: true, reachable: false, message: error instanceof Error ? error.message : "Falha ao consultar VPS." });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  if (loading) {
    return <div className="mt-4 h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />;
  }

  if (!data.configured) {
    return (
      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-200"><TriangleAlert size={17} /></span>
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
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Server size={16} className="text-violet-700" />
            <h4 className="text-[12px] font-black text-[#07182d]">Servidor VPS · Telemetria completa</h4>
          </div>
          <p className="mt-1 text-[9px] text-slate-400">{data.hostname || data.publicIp || "Servidor de teste"}{data.os ? ` · ${data.os}` : ""}{data.kernel ? ` · Kernel ${data.kernel}` : ""}</p>
        </div>
        <span className={`inline-flex self-start items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ${data.reachable ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {data.reachable ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />}
          {data.reachable ? "Servidor respondendo" : "Servidor sem resposta"}
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="CPU" value={pct(data.cpuPercent)} icon={<Cpu size={12} />} />
          <Metric label="Núcleos CPU" value={data.cpuCores != null ? String(data.cpuCores) : "—"} icon={<Cpu size={12} />} />
          <Metric label="Memória RAM" value={data.memoryPercent != null ? `${pct(data.memoryPercent)} · ${formatBytes(data.memoryUsedBytes)} / ${formatBytes(data.memoryTotalBytes)}` : "—"} icon={<MemoryStick size={12} />} />
          <Metric label="Swap" value={data.swapPercent != null ? `${pct(data.swapPercent)} · ${formatBytes(data.swapUsedBytes)} / ${formatBytes(data.swapTotalBytes)}` : "—"} icon={<MemoryStick size={12} />} />
          <Metric label="Disco" value={data.diskPercent != null ? `${pct(data.diskPercent)} · ${formatBytes(data.diskUsedBytes)} / ${formatBytes(data.diskTotalBytes)}` : "—"} icon={<HardDrive size={12} />} />
          <Metric label="Disco livre" value={formatBytes(data.diskFreeBytes)} icon={<HardDrive size={12} />} />
          <Metric label="Uptime" value={formatUptime(data.uptimeSeconds)} icon={<Activity size={12} />} />
          <Metric label="Latência health" value={data.latencyMs != null ? `${data.latencyMs} ms` : "—"} icon={<Gauge size={12} />} />
          <Metric label="Load 1m" value={data.load1 != null ? data.load1.toFixed(2) : "—"} icon={<Activity size={12} />} />
          <Metric label="Load 5m" value={data.load5 != null ? data.load5.toFixed(2) : "—"} icon={<Activity size={12} />} />
          <Metric label="Load 15m" value={data.load15 != null ? data.load15.toFixed(2) : "—"} icon={<Activity size={12} />} />
          <Metric label="Processos" value={data.processCount != null ? String(data.processCount) : "—"} icon={<Activity size={12} />} />
          <Metric label="Containers" value={data.containersTotal != null ? `${data.containersRunning ?? 0}/${data.containersTotal}` : "—"} icon={<Server size={12} />} />
          <Metric label="Rede recebida" value={formatBytes(data.networkRxBytes)} icon={<Activity size={12} />} />
          <Metric label="Rede enviada" value={formatBytes(data.networkTxBytes)} icon={<Activity size={12} />} />
          <Metric label="Modelo CPU" value={data.cpuModel || "—"} icon={<Cpu size={12} />} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Service label="Aplicação" state={data.app} />
          <Service label="Docker" state={data.docker} />
          <Service label="Caddy" state={data.caddy || data.nginx} />
          <Service label="PostgreSQL" state={data.postgres} />
          <Service label="Health endpoint" state={data.reachable ? "online" : "offline"} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wide text-slate-400"><ShieldCheck size={12} />SSL</div>
            <b className={`mt-1 block text-[11px] ${data.sslValid === true ? "text-emerald-700" : data.sslValid === false ? "text-rose-700" : "text-slate-500"}`}>
              {data.sslValid === true ? "Válido" : data.sslValid === false ? "Inválido / expirado" : "Sem dado"}
              {data.sslExpiresAt ? ` · expira ${new Date(data.sslExpiresAt).toLocaleDateString("pt-BR")}` : ""}
            </b>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wide text-slate-400"><Database size={12} />Endpoint</div>
            <b className="mt-1 block text-[11px] text-[#07182d]">{data.statusCode ? `HTTP ${data.statusCode}` : "—"}{data.version ? ` · agente ${data.version}` : ""}</b>
          </div>
        </div>

        {data.message && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800">{data.message}</p>}
      </div>
    </section>
  );
}
