import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Building2, CalendarDays,
  Cloud, FileChartColumn, Folder, Headphones, Landmark,
  Link2, MoreHorizontal, PanelsTopLeft, Plus, RefreshCw, Settings2, UsersRound, Wallet,
} from "lucide-react";
import { getAccounts, getMovements, type Movement } from "../lib/finance";
import { isAppwriteConfigured as isConfigured } from "../lib/appwrite";
import { getExpenses } from "../services/expenses";
import { getDriveStorageUsage, type DriveStorageUsage } from "../services/googleDrive";

const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const onlyDate = (value: unknown) => String(value || "").slice(0, 10);

export default function Dashboard() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [account, setAccount] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [drive, setDrive] = useState<DriveStorageUsage | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState("");

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([getMovements(500), getAccounts(), getExpenses().catch(() => [])]).then(([m, a, e]) => {
      setRows(m);
      setAccount(a.reduce((sum, item) => sum + Number(item.saldo_atual || 0), 0));
      setExpenses(e);
    });
  }, []);

  const loadDrive = () => {
    if (!isConfigured) { setDriveLoading(false); return; }
    setDriveLoading(true);
    setDriveError("");
    getDriveStorageUsage().then(setDrive).catch((e: Error) => setDriveError(e.message)).finally(() => setDriveLoading(false));
  };
  useEffect(loadDrive, []);

  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const current = rows.filter((x) => onlyDate(x.data).startsWith(month));
  const entradas = current.filter((x) => x.tipo.includes("entrada")).reduce((s, x) => s + Number(x.valor || 0), 0);
  const saidas = current.filter((x) => x.tipo.includes("saida")).reduce((s, x) => s + Number(x.valor || 0), 0);
  const receberHoje = current.filter((x) => x.tipo.includes("entrada") && onlyDate(x.data) === today).reduce((s, x) => s + Number(x.valor || 0), 0);
  const pagarHoje = current.filter((x) => x.tipo.includes("saida") && onlyDate(x.data) === today).reduce((s, x) => s + Number(x.valor || 0), 0);
  const pendentes = expenses.filter((x) => x.status === "pendente" && onlyDate(x.data_vencimento || x.vencimento).startsWith(month));
  const pendenteTotal = pendentes.reduce((s, x) => s + Number(x.valor || 0), 0);
  const chart = useMemo(() => buildChart(rows), [rows]);
  const recent = rows.slice(0, 4);

  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now);

  return (
    <div className="space-y-4 pb-5">
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)] lg:grid-cols-[1.35fr_.75fr_.55fr] lg:items-center">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[.24em] text-[#d49d24]">MW TECH CONTROL</p>
          <h1 className="mt-1 text-[32px] font-black tracking-[-.03em] text-[#071d35] sm:text-[38px]">Visão geral da empresa</h1>
          <p className="mt-1.5 text-sm text-slate-500">Acompanhe em tempo real os principais indicadores, sistemas e informações da MW TECH.</p>
        </div>
        <div className="border-slate-200 lg:border-l lg:pl-7">
          <p className="flex items-center gap-2 text-xs font-semibold capitalize text-slate-500"><CalendarDays size={15}/>{dateLabel}</p>
          <h2 className="mt-2 text-[22px] font-black text-[#071d35]">Olá, Administrador!</h2>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50"/>Tudo funcionando normalmente.</p>
        </div>
        <div className="flex min-h-[92px] items-center gap-4 rounded-2xl border border-[#b78a2b]/30 bg-gradient-to-br from-[#092440] to-[#102b42] px-5 text-white shadow-sm">
          <span className="grid size-12 place-items-center rounded-xl bg-[#d5a336]/15 text-[#f5c75b]"><BarChart3 size={25}/></span>
          <div className="flex-1"><b className="block text-sm">Gestão eficiente</b><span className="text-xs text-slate-300">para um futuro maior.</span></div><ArrowRight size={18} className="text-[#f5c75b]"/>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ArrowUpRight/>} title="A receber hoje" value={brl(receberHoje)} hint={`${current.filter(x => x.tipo.includes("entrada") && onlyDate(x.data) === today).length} lançamento(s)`} action="Ver recebimentos" href="/movimentacoes" tone="green"/>
        <MetricCard icon={<ArrowDownRight/>} title="A pagar hoje" value={brl(pagarHoje)} hint={`${current.filter(x => x.tipo.includes("saida") && onlyDate(x.data) === today).length} lançamento(s)`} action="Ver pagamentos" href="/despesas" tone="orange"/>
        <MetricCard icon={<BarChart3/>} title="Saldo em caixa" value={brl(account)} hint="Saldo total disponível" action="Ver fluxo de caixa" href="/caixa" tone="blue"/>
        <MetricCard icon={<UsersRound/>} title="Usuários e acessos" value="Controle central" hint="Permissões por função" action="Gerenciar usuários" href="/usuarios" tone="slate"/>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2.2fr_.8fr]">
        <DriveCard data={drive} loading={driveLoading} error={driveError} refresh={loadDrive}/>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)]">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={21}/></span><h3 className="font-black text-[#071d35]">Sistemas e órgãos</h3></div><a href="/sistemas" className="text-xs font-bold text-blue-700">Ver todos →</a></div>
          <div className="space-y-2.5">
            <SideItem icon={<Building2 size={18}/>} title="Prefeituras e órgãos" subtitle="Ambientes gerenciados"/>
            <SideItem icon={<PanelsTopLeft size={18}/>} title="Sistemas ativos" subtitle="Acessos centralizados"/>
            <SideItem icon={<Link2 size={18}/>} title="Integrações" subtitle="Serviços conectados"/>
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_.86fr_.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)]">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><BarChart3 size={19}/></span><h3 className="font-black text-[#071d35]">Fluxo financeiro do mês</h3></div><span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Últimos 6 meses</span></div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chart} barGap={4}><CartesianGrid stroke="#edf2f7" vertical={false}/><XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#64748b"}}/><YAxis axisLine={false} tickLine={false} width={58} tick={{fontSize:10,fill:"#64748b"}} tickFormatter={(v)=>`R$ ${Math.round(v/1000)}k`}/><Tooltip formatter={(v)=>brl(Number(v))}/><Bar dataKey="entradas" name="Recebimentos" fill="#34c993" radius={[6,6,0,0]} maxBarSize={24}/><Bar dataKey="saidas" name="Pagamentos" fill="#f49b45" radius={[6,6,0,0]} maxBarSize={24}/></BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex justify-center gap-5 text-[11px] font-semibold text-slate-500"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-emerald-400"/>Recebimentos</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-orange-400"/>Pagamentos</span></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)]">
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileChartColumn size={19}/></span><h3 className="font-black text-[#071d35]">Últimos lançamentos</h3></div><a href="/movimentacoes" className="text-xs font-bold text-blue-700">Ver todos →</a></div>
          <div className="divide-y divide-slate-100">
            {recent.length ? recent.map((x) => {
              const entry = x.tipo.includes("entrada");
              return <div key={x.id} className="flex items-center gap-3 py-3"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${entry ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{entry ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-[#071d35]">{x.descricao || (entry ? "Recebimento" : "Pagamento")}</b><span className="text-[11px] text-slate-400">{new Date(x.data).toLocaleDateString("pt-BR")}</span></div><b className={`text-xs ${entry ? "text-emerald-600" : "text-rose-600"}`}>{brl(Number(x.valor))}</b></div>
            }) : <div className="py-10 text-center text-xs text-slate-400">Nenhum lançamento recente.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)]">
          <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">⚡</span><h3 className="font-black text-[#071d35]">Acesso rápido</h3></div>
          <div className="grid grid-cols-3 gap-2.5">
            <Quick href="/movimentacoes" icon={<Plus size={20}/>} label="Novo lançamento" tone="green"/>
            <Quick href="/contas" icon={<Landmark size={20}/>} label="Contas bancárias" tone="blue"/>
            <Quick href="/relatorios" icon={<FileChartColumn size={20}/>} label="Relatórios" tone="purple"/>
            <Quick href="/usuarios" icon={<UsersRound size={20}/>} label="Usuários" tone="orange"/>
            <Quick href="/suporte" icon={<Headphones size={20}/>} label="Suporte" tone="blue"/>
            <Quick href="/configuracoes" icon={<Settings2 size={20}/>} label="Configurações" tone="slate"/>
          </div>
        </section>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Recebimentos do mês" value={brl(entradas)} icon={<ArrowUpRight size={18}/>} tone="green"/>
        <MiniStat label="Pagamentos do mês" value={brl(saidas)} icon={<ArrowDownRight size={18}/>} tone="orange"/>
        <MiniStat label="A pagar no mês" value={brl(pendenteTotal)} icon={<Wallet size={18}/>} tone="blue"/>
      </section>
    </div>
  );
}

function MetricCard({icon,title,value,hint,action,href,tone}:{icon:ReactNode;title:string;value:string;hint:string;action:string;href:string;tone:"green"|"orange"|"blue"|"slate"}) {
  const styles = {green:"bg-emerald-50 text-emerald-600",orange:"bg-orange-50 text-orange-600",blue:"bg-blue-50 text-blue-600",slate:"bg-slate-100 text-slate-600"}[tone];
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)]"><div className="flex items-start gap-4"><span className={`grid size-12 shrink-0 place-items-center rounded-full ${styles}`}>{icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#18324d]">{title}</p><strong className="mt-1 block truncate text-[24px] font-black tracking-[-.025em] text-[#071d35]">{value}</strong><span className="mt-1 block text-xs text-slate-400">{hint}</span><a href={href} className="mt-3 flex items-center justify-end gap-1.5 text-xs font-bold text-blue-700">{action}<ArrowRight size={14}/></a></div></div></article>;
}

function DriveCard({data,loading,error,refresh}:{data:DriveStorageUsage|null;loading:boolean;error:string;refresh:()=>void}) {
  const pct = Math.max(0,Math.min(100,data?.percent || 0));
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,70,.05)]">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Cloud size={23}/></span><div><h3 className="font-black text-[#071d35]">Armazenamento Google Drive</h3><p className="text-xs text-slate-400">Pastas organizadas por prefeitura/órrgão</p></div></div><div className="flex gap-2"><button onClick={refresh} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" title="Atualizar"><RefreshCw size={16} className={loading?"animate-spin":""}/></button><button className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600"><MoreHorizontal size={17}/></button></div></div>
    {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Google Drive aguardando configuração: {error}</div> : loading ? <div className="grid h-44 place-items-center text-sm text-slate-400"><RefreshCw className="animate-spin"/></div> : <div className="grid gap-4 lg:grid-cols-[.8fr_.9fr_1.25fr]">
      <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4"><div className="relative grid size-28 shrink-0 place-items-center rounded-full" style={{background:`conic-gradient(#1478df ${pct*3.6}deg,#e9eef5 0deg)`}}><div className="grid size-20 place-items-center rounded-full bg-white"><b className="text-xl text-[#071d35]">{pct.toFixed(0)}%</b></div></div><div><b className="block text-sm text-[#071d35]">{pct.toFixed(0)}% utilizado</b><span className="mt-1 block text-xs text-slate-400">{data?.usedGb?.toFixed(1) || "0,0"} GB de {data?.totalGb?.toFixed(0) || "0"} GB</span></div></div>
      <div className="space-y-2 rounded-xl border border-slate-100 p-3"><DriveLine label="Espaço utilizado" value={`${data?.usedGb?.toFixed(1) || "0,0"} GB`}/><DriveLine label="Espaço disponível" value={`${data?.availableGb?.toFixed(1) || "0,0"} GB`}/><DriveLine label="Total do plano" value={`${data?.totalGb?.toFixed(0) || "0"} GB`}/></div>
      <div className="rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between"><b className="text-xs text-[#071d35]">Pastas por prefeitura/órgão</b><span className="text-[11px] font-bold text-blue-700">Ver todas →</span></div><div className="space-y-1.5">{(data?.folders || []).slice(0,5).map(f=><div key={f.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2"><Folder size={15} className="text-amber-500"/><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-600">{f.name}</span><b className="text-[11px] text-slate-500">{f.usedGb.toFixed(1)} GB</b></div>)}{!data?.folders?.length && <p className="py-6 text-center text-xs text-slate-400">Nenhuma pasta retornada.</p>}</div></div>
    </div>}
  </section>;
}

function DriveLine({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3"><span className="text-[11px] text-slate-500">{label}</span><b className="text-xs text-[#071d35]">{value}</b></div>}
function SideItem({icon,title,subtitle}:{icon:ReactNode;title:string;subtitle:string}){return <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><span className="grid size-9 place-items-center rounded-lg bg-white text-blue-700">{icon}</span><div className="flex-1"><b className="block text-xs text-[#071d35]">{title}</b><span className="text-[11px] text-slate-400">{subtitle}</span></div><span className="size-2.5 rounded-full bg-emerald-500"/></div>}
function Quick({href,icon,label,tone}:{href:string;icon:ReactNode;label:string;tone:"green"|"blue"|"purple"|"orange"|"slate"}){const s={green:"bg-emerald-50 text-emerald-600",blue:"bg-blue-50 text-blue-600",purple:"bg-violet-50 text-violet-600",orange:"bg-orange-50 text-orange-600",slate:"bg-slate-100 text-slate-600"}[tone];return <a href={href} className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl p-2 text-center text-[11px] font-bold transition hover:-translate-y-0.5 ${s}`}>{icon}<span>{label}</span></a>}
function MiniStat({label,value,icon,tone}:{label:string;value:string;icon:ReactNode;tone:"green"|"orange"|"blue"}){const s={green:"bg-emerald-50 text-emerald-600",orange:"bg-orange-50 text-orange-600",blue:"bg-blue-50 text-blue-600"}[tone];return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-10 place-items-center rounded-xl ${s}`}>{icon}</span><div><span className="block text-[11px] font-semibold text-slate-400">{label}</span><b className="text-sm text-[#071d35]">{value}</b></div></div>}

function buildChart(rows: Movement[]){
  const fmt = new Intl.DateTimeFormat("pt-BR",{month:"short"});
  return Array.from({length:6},(_,i)=>{
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i));
    const key=d.toISOString().slice(0,7);
    const list=rows.filter(x=>onlyDate(x.data).startsWith(key));
    return {mes:fmt.format(d).replace(".","").replace(/^./,c=>c.toUpperCase()),entradas:list.filter(x=>x.tipo.includes("entrada")).reduce((s,x)=>s+Number(x.valor||0),0),saidas:list.filter(x=>x.tipo.includes("saida")).reduce((s,x)=>s+Number(x.valor||0),0)};
  });
}
