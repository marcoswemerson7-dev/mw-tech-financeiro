import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  ExternalLink,
  FileStack,
  Gauge,
  HardDrive,
  History,
  Receipt,
  RefreshCw,
  Server,
  ShieldCheck,
  UserCheck,
  UsersRound,
  WifiOff,
} from "lucide-react";
import { ActionButton, PageHeader } from "../components/UI";
import {
  getSystemHealth,
  type EndpointHealth,
  type HealthState,
  type MonitoringMetrics,
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
  const mb = value / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem acesso registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#0b355d] shadow-sm ring-1 ring-slate-200">
          {icon}
        </span>
        <div className="min-w-0">
          <b className="block text-[13px] text-[#07182d]">{title}</b>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{health.message}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${stateClasses(health.state)}`}>
          <span className={`size-1.5 rounded-full ${dotClasses(health.state)}`} />
          {stateLabel(health.state)}
        </span>
        <p className="mt-1 text-[10px] font-semibold text-slate-400">
          {health.latencyMs !== null ? `${health.latencyMs} ms` : "sem leitura"}
        </p>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "blue" | "emerald" | "amber" | "violet" | "slate";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ring-1 ${styles}`}>{icon}</span>
        <div className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[.08em] text-slate-400">{label}</span>
          <b className="mt-1 block text-lg font-black text-[#07182d]">{value}</b>
          {hint && <p className="mt-0.5 truncate text-[10px] text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function UsersPanel({ metrics, tenant }: { metrics: MonitoringMetrics; tenant: "rg" | "bg" }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-[#07182d]">
            <UsersRound size={17} className="text-blue-700" /> Usuários e atividade
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Leitura agregada do Supabase, sem expor dados pessoais.</p>
        </div>
        <Link to={`/monitoramento/usuarios?tenant=${tenant}`} className="rounded-full bg-[#082743] px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-[#0b355d]">Ver usuários</Link>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<UsersRound size={17} />} label="Cadastrados" value={metrics.users ?? "—"} tone="blue" />
        <StatTile icon={<UserCheck size={17} />} label="Habilitados" value={metrics.activeUsers ?? "—"} tone="emerald" />
        <StatTile icon={<Activity size={17} />} label="Acesso em 30 min" value={metrics.recent30m ?? "—"} hint="atividade recente" tone="violet" />
        <StatTile icon={<Clock3 size={17} />} label="Ativos em 24h" value={metrics.active24h ?? "—"} hint={`${metrics.active7d ?? 0} em 7 dias`} tone="amber" />
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] text-slate-600">
        <History size={14} className="text-slate-400" />
        <span>Último acesso registrado: <b className="text-[#07182d]">{formatDateTime(metrics.latestLoginAt)}</b></span>
      </div>
    </section>
  );
}

function OperationalPanel({ metrics }: { metrics: MonitoringMetrics }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#07182d]">Volume operacional</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Indicadores reais do banco do sistema.</p>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">
          Atualizado {metrics.checkedAt ? new Date(metrics.checkedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<FileStack size={17} />} label="Processos" value={metrics.processes ?? "—"} tone="blue" />
        <StatTile icon={<ShieldCheck size={17} />} label="Contratos" value={metrics.contracts ?? "—"} tone="slate" />
        <StatTile icon={<Receipt size={17} />} label="Notas fiscais" value={metrics.invoices ?? "—"} tone="amber" />
        <StatTile icon={<CreditCard size={17} />} label="Pagamentos" value={metrics.payments ?? "—"} tone="emerald" />
        <StatTile icon={<HardDrive size={17} />} label="Arquivos registrados" value={metrics.files ?? "—"} hint={formatBytes(metrics.fileBytes)} tone="violet" />
        <StatTile icon={<Activity size={17} />} label="Ações em 24h" value={metrics.audit24h ?? "—"} tone="blue" />
        <StatTile icon={<Database size={17} />} label="Banco de dados" value={formatBytes(metrics.databaseBytes)} tone="slate" />
        <StatTile icon={<Gauge size={17} />} label="Atividade 7 dias" value={metrics.active7d ?? "—"} hint="usuários com acesso" tone="emerald" />
      </div>
    </section>
  );
}

function SystemCard({ item }: { item: SystemHealthSnapshot }) {
  const StatusIcon = iconFor(item.overall);
  const isBg = item.key === "bg";
  const metricsOk = Boolean(item.metrics?.configured);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(7,24,45,.06)]">
      <div className={`relative overflow-hidden px-5 py-4 text-white ${isBg ? "bg-gradient-to-r from-[#07192c] via-[#0a3a29] to-[#0d6240]" : "bg-gradient-to-r from-[#07192c] via-[#0b315b] to-[#165493]"}`}>
        <div className="absolute -right-12 -top-14 size-44 rounded-full bg-white/[.07] blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/60">Gestão Licita</p>
            <h2 className="mt-1 text-lg font-black leading-tight">{item.shortName}</h2>
            <p className="mt-0.5 text-xs text-white/70">{item.city}</p>
          </div>
          <span className={`grid size-10 place-items-center rounded-xl border border-white/15 ${item.overall === "online" ? "bg-emerald-400/15 text-emerald-200" : item.overall === "offline" ? "bg-rose-400/15 text-rose-200" : "bg-amber-300/15 text-amber-100"}`}>
            <StatusIcon size={20} />
          </span>
        </div>
        <div className="relative mt-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-2.5 py-1 text-[10px] font-black">
            <span className={`size-1.5 rounded-full ${dotClasses(item.overall)}`} />
            {stateLabel(item.overall)}
          </span>
          {item.accessUrl && (
            <a href={item.accessUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/80 hover:text-white">
              Abrir sistema <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <EndpointRow icon={<Server size={17} />} title="Aplicação / domínio" health={item.app} />
          <EndpointRow icon={<Database size={17} />} title="Banco Supabase" health={item.database} />
        </div>

        {metricsOk && item.metrics ? (
          <>
            <UsersPanel metrics={item.metrics} tenant={item.key} />
            <OperationalPanel metrics={item.metrics} />
          </>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <b className="block">Não foi possível carregar as métricas detalhadas.</b>
            <span className="mt-1 block text-xs">{item.metrics?.message || "A disponibilidade continua sendo monitorada normalmente."}</span>
          </div>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3.5">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
              <Gauge size={14} /> Resposta da aplicação
            </span>
            <b className="mt-1.5 block text-xl font-black text-[#07182d]">
              {item.app.latencyMs !== null ? `${item.app.latencyMs} ms` : "—"}
            </b>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {item.app.latencyMs !== null && item.app.latencyMs <= 800 ? "Resposta rápida." : item.app.latencyMs !== null && item.app.latencyMs <= 2500 ? "Resposta dentro do aceitável." : "Verifique possível lentidão."}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3.5">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
              <ShieldCheck size={14} /> Infraestrutura
            </span>
            <b className="mt-1.5 block text-sm font-black text-[#07182d]">
              Supabase conectado · {item.vercelUrl ? "Vercel vinculada" : "Vercel sem link"}
            </b>
            {item.vercelUrl ? (
              <a href={item.vercelUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline">
                Abrir projeto Vercel <ExternalLink size={12} />
              </a>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500">Cadastre o link em Sistemas e órgãos.</p>
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
    const latencies = items.map((item) => item.app.latencyMs).filter((value): value is number => value !== null);
    const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    const users = items.reduce((sum, item) => sum + Number(item.metrics?.users || 0), 0);
    const activeUsers = items.reduce((sum, item) => sum + Number(item.metrics?.activeUsers || 0), 0);
    const recent30m = items.reduce((sum, item) => sum + Number(item.metrics?.recent30m || 0), 0);
    const processes = items.reduce((sum, item) => sum + Number(item.metrics?.processes || 0), 0);
    return { online, attention, offline, average, users, activeUsers, recent30m, processes };
  }, [items]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoramento dos sistemas"
        subtitle="Saúde, disponibilidade e uso real do Gestão Licita de Ribeiro Gonçalves e Baixa Grande do Ribeiro."
        actions={
          <ActionButton onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando..." : "Atualizar agora"}
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Sistemas operacionais" value={loading ? "—" : `${summary.online}/${items.length || 2}`} icon={<CheckCircle2 size={19} />} tone="emerald" hint={summary.offline ? `${summary.offline} indisponível` : summary.attention ? `${summary.attention} em atenção` : "Tudo normal"} />
        <Link to="/monitoramento/usuarios" className="block"><SummaryCard label="Usuários cadastrados" value={loading ? "—" : String(summary.users)} icon={<UsersRound size={19} />} tone="blue" hint={`${summary.activeUsers} habilitados · clique para ver`} /></Link>
        <SummaryCard label="Atividade recente" value={loading ? "—" : String(summary.recent30m)} icon={<Activity size={19} />} tone="violet" hint="acessos nos últimos 30 min" />
        <SummaryCard label="Processos monitorados" value={loading ? "—" : String(summary.processes)} icon={<FileStack size={19} />} tone="amber" hint="RG + BG" />
        <SummaryCard label="Resposta média" value={loading || summary.average === null ? "—" : `${summary.average} ms`} icon={<Gauge size={19} />} tone="blue" hint={summary.average !== null && summary.average <= 800 ? "boa resposta" : "acompanhar latência"} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Clock3 size={17} /></span>
          <div>
            <b className="block text-[13px] text-[#07182d]">Monitoramento automático ativo</b>
            <p className="text-[11px] text-slate-500">Atualização a cada 60 segundos · próxima em {nextRefresh}s</p>
          </div>
        </div>
        <p className="text-[11px] font-semibold text-slate-400">Última leitura: {lastChecked(items)}</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {loading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-[620px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />)}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {items.map((item) => <SystemCard key={item.key} item={item} />)}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <h3 className="text-[13px] font-black text-[#07182d]">Como interpretar o painel</h3>
        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          O status operacional testa domínio e Supabase. Os indicadores de usuários e volume são snapshots agregados dos bancos de RG e BG.
          “Acesso em 30 min” indica usuários que fizeram login recentemente — não significa necessariamente que continuam com a tela aberta.
          Os números agregados não expõem dados pessoais. Detalhes de usuários só são carregados na área administrativa autenticada; senha nunca é exibida.
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
  hint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "emerald" | "amber" | "rose" | "blue" | "violet";
  hint?: string;
}) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
          <b className="mt-1 block text-2xl font-black text-[#07182d]">{value}</b>
          {hint && <p className="mt-0.5 truncate text-[10px] text-slate-500">{hint}</p>}
        </div>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ring-1 ${styles}`}>{icon}</span>
      </div>
    </div>
  );
}
