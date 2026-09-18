import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BellRing, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert, Siren, Wrench, CalendarDays, BarChart3 } from "lucide-react";
import { ActionButton, PageHeader } from "../components/UI";
import {
  acknowledgeIncident,
  getMonitoringIncidents,
  requestIncidentNotifications,
  type IncidentHistoryItem,
  type MonitoringIncident,
} from "../services/incidents";
import { getMonthlyAvailability, type MonthlyAvailabilityRow } from "../services/centralMonitoring";

function fmt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(date);
}

export default function IncidentCenter() {
  const [active, setActive] = useState<MonitoringIncident[]>([]);
  const [history, setHistory] = useState<IncidentHistoryItem[]>([]);
  const [tab, setTab] = useState<"active"|"history">("active");
  const [filter, setFilter] = useState<"all"|"mw"|"rg"|"bg">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState(() => "Notification" in window ? Notification.permission : "unsupported");
  const [storage, setStorage] = useState<"central"|"local">("local");
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [reportRows, setReportRows] = useState<MonthlyAvailabilityRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await getMonitoringIncidents();
      setActive(result.active);
      setHistory(result.history);
      setStorage(result.storage || "local");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar incidentes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const rows = useMemo(() => {
    const source = tab === "active" ? active : history;
    return source.filter((item) => filter === "all" || item.system === filter);
  }, [tab,active,history,filter]);

  const summary = useMemo(() => ({
    critical: active.filter(x=>x.severity==="critical").length,
    warning: active.filter(x=>x.severity==="warning").length,
    systems: new Set(active.map(x=>x.system)).size,
  }),[active]);

  async function enableNotifications() {
    const result = await requestIncidentNotifications();
    setPermission(result);
  }

  async function loadMonthlyReport(month = reportMonth) {
    setReportLoading(true);
    try {
      const report = await getMonthlyAvailability(month);
      setReportRows(report.systems);
      setStorage("central");
    } catch (e) {
      // O relatório central depende do Appwrite; se a função estiver sem escopos,
      // mantemos a central utilizável com os incidentes locais e uma mensagem amigável.
      const message = e instanceof Error ? e.message : "";
      if (/missing scopes|tables\.read|collections\.read|não concluída/i.test(message)) {
        setReportRows([]);
        setStorage("local");
        return;
      }
      setError(message || "Não foi possível gerar o relatório mensal.");
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    void loadMonthlyReport(reportMonth);
  }, []);

  return <div className="mx-auto w-full max-w-[1700px] space-y-5">
    <PageHeader title="Central de Incidentes" subtitle="Alertas operacionais e técnicos dos sistemas MW TECH, Gestão Licita RG e Gestão Licita BG."
      actions={<div className="flex flex-wrap gap-2">
        <ActionButton tone="outline" onClick={enableNotifications}><BellRing size={16}/>{permission==="granted"?"Notificações ativas":"Ativar notificações"}</ActionButton>
        <ActionButton onClick={()=>void load()}><RefreshCw size={16}/>Atualizar agora</ActionButton>
      </div>}/>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card label="Críticos" value={summary.critical} icon={<Siren size={20}/>} tone="rose"/>
      <Card label="Atenção" value={summary.warning} icon={<AlertTriangle size={20}/>} tone="amber"/>
      <Card label="Sistemas afetados" value={summary.systems} icon={<ShieldAlert size={20}/>} tone="blue"/>
      <Card label="Monitorados" value={3} icon={<CheckCircle2 size={20}/>} tone="green"/>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      {(["all","mw","rg","bg"] as const).map((id)=><button key={id} onClick={()=>setFilter(id)} className={`rounded-lg px-3 py-2 text-xs font-black ${filter===id?"bg-[#082743] text-white":"text-slate-600 hover:bg-slate-100"}`}>{id==="all"?"Todos":id==="mw"?"MW TECH":id.toUpperCase()}</button>)}
      <div className="ml-auto flex rounded-lg bg-slate-100 p-1">
        <button onClick={()=>setTab("active")} className={`rounded-md px-3 py-1.5 text-xs font-black ${tab==="active"?"bg-white shadow-sm":"text-slate-500"}`}>Ativos ({active.length})</button>
        <button onClick={()=>setTab("history")} className={`rounded-md px-3 py-1.5 text-xs font-black ${tab==="history"?"bg-white shadow-sm":"text-slate-500"}`}>Histórico</button>
      </div>
    </div>

    <div className={`rounded-xl border px-4 py-3 text-xs font-semibold ${storage==="central"?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-amber-200 bg-amber-50 text-amber-800"}`}>
      Histórico: <b>{storage==="central" ? "Banco central MW TECH" : "modo local temporário"}</b>. {storage==="central" ? "Os mesmos dados aparecem em qualquer dispositivo autorizado." : "A central continuará tentando sincronizar automaticamente quando o backend estiver disponível."}
    </div>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

    {loading ? <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm"/> : rows.length ? <div className="space-y-3">
      {rows.map((item:any)=>{
        const acknowledged = Boolean(item.acknowledged);
        const critical = item.severity==="critical";
        return <article key={item.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${critical?"border-rose-200":"border-amber-200"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${critical?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{critical?<Siren size={19}/>:<AlertTriangle size={19}/>}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><b className="text-sm text-[#07182d]">{item.title}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{item.systemLabel}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{item.source}</span></div>
              <p className="mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">{fmt(item.occurredAt)}{item.occurrences ? ` · ${item.occurrences} leitura(s)`:""}{item.resolvedAt ? ` · resolvido ${fmt(item.resolvedAt)}`:""}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {item.actionUrl && <a href={item.actionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-50">Abrir <ExternalLink size={12}/></a>}
              {item.active && !acknowledged && <button onClick={()=>void acknowledgeIncident(item.id).then(()=>load())} className="rounded-lg bg-[#082743] px-3 py-2 text-[10px] font-black text-white">Reconhecer</button>}
            </div>
          </div>
        </article>
      })}
    </div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={30}/><b className="mt-3 block text-emerald-800">Nenhum incidente ativo</b><p className="mt-1 text-sm text-emerald-700">Os sistemas monitorados não apresentam alertas no momento.</p></div>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-[#07182d] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10"><BarChart3 size={19}/></span>
          <div><h2 className="text-sm font-black">Relatório mensal de disponibilidade</h2><p className="mt-0.5 text-[10px] text-blue-100">Consolidado do histórico central de incidentes.</p></div>
        </div>
        <div className="flex gap-2">
          <input type="month" value={reportMonth} onChange={(e)=>setReportMonth(e.target.value)} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white outline-none"/>
          <button onClick={()=>void loadMonthlyReport()} disabled={reportLoading} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#07182d] disabled:opacity-60"><CalendarDays size={14}/>{reportLoading?"Gerando...":"Gerar"}</button>
        </div>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-3">
        {(reportRows.length ? reportRows : (["mw","rg","bg"] as const).map((system)=>({system,incidents:0,criticalIncidents:0,downtimeMinutes:0,availability:100}))).map((row)=>(
          <div key={row.system} className="rounded-xl border border-slate-200 bg-[#f8fafc] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Sistema</span><b className="mt-1 block text-sm text-[#07182d]">{row.system==="mw"?"MW TECH Control":row.system==="rg"?"Gestão Licita RG":"Gestão Licita BG"}</b></div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.availability>=99.9?"bg-emerald-50 text-emerald-700":row.availability>=99?"bg-amber-50 text-amber-700":"bg-rose-50 text-rose-700"}`}>{row.availability.toFixed(3)}%</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200"><span className="text-[9px] font-black uppercase text-slate-400">Incidentes</span><b className="mt-1 block text-lg text-[#07182d]">{row.incidents}</b></div>
              <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200"><span className="text-[9px] font-black uppercase text-slate-400">Críticos</span><b className="mt-1 block text-lg text-[#07182d]">{row.criticalIncidents}</b></div>
              <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200"><span className="text-[9px] font-black uppercase text-slate-400">Indisponível</span><b className="mt-1 block text-sm text-[#07182d]">{row.downtimeMinutes.toFixed(1)} min</b></div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-[10px] leading-5 text-slate-500">
        A disponibilidade é estimada a partir dos incidentes críticos de saúde registrados no banco central. Períodos sobrepostos são consolidados para não contar a mesma indisponibilidade duas vezes.
      </div>
    </section>

    <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
      <Wrench size={19} className="text-blue-700"/>
      <div className="flex-1"><b className="text-xs text-[#07182d]">Monitoramento contínuo</b><p className="mt-1 text-[11px] leading-5 text-slate-600">A central combina health check interno, domínio, Supabase, incidentes operacionais, Sentry e Vercel. Notificações do navegador funcionam enquanto este dispositivo permitir notificações para o MW TECH Control.</p></div>
      <Link to="/monitoramento" className="text-xs font-black text-blue-700">Voltar ao monitoramento</Link>
    </div>
  </div>;
}

function Card({label,value,icon,tone}:{label:string;value:number;icon:React.ReactNode;tone:"rose"|"amber"|"blue"|"green"}){
  const cls=tone==="rose"?"bg-rose-50 text-rose-700":tone==="amber"?"bg-amber-50 text-amber-700":tone==="green"?"bg-emerald-50 text-emerald-700":"bg-blue-50 text-blue-700";
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-10 place-items-center rounded-lg ${cls}`}>{icon}</span><div><span className="text-[11px] font-bold text-slate-500">{label}</span><b className="block text-2xl font-black text-[#07182d]">{value}</b></div></div>
}
