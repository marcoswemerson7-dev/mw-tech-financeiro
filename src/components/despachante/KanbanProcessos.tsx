import { useMemo, useState } from "react";
import { CalendarDays, GripVertical, MapPin, Search, ArrowUpRight, ClipboardList, AlertTriangle } from "lucide-react";
import type { Tracking } from "./Processos";

type Process = Tracking & { id:string; clientId:string; title:string; created:string };
type Client = {id:string; name:string; phone:string};
const columns = [
  { id:"preparacao",label:"Em preparação",tone:"slate",line:"bg-slate-500",chip:"bg-slate-100 text-slate-700" },
  { id:"protocolado",label:"Protocolado",tone:"sky",line:"bg-sky-500",chip:"bg-sky-100 text-sky-800" },
  { id:"analise",label:"Em análise",tone:"violet",line:"bg-violet-500",chip:"bg-violet-100 text-violet-800" },
  { id:"devolutiva",label:"Nota devolutiva",tone:"orange",line:"bg-orange-500",chip:"bg-orange-100 text-orange-800" },
  { id:"cliente",label:"Aguardando cliente",tone:"amber",line:"bg-amber-500",chip:"bg-amber-100 text-amber-800" },
  { id:"finalizado",label:"Finalizado",tone:"emerald",line:"bg-emerald-500",chip:"bg-emerald-100 text-emerald-800" },
  { id:"cancelado",label:"Cancelado",tone:"rose",line:"bg-rose-500",chip:"bg-rose-100 text-rose-800" },
] as const;
const inactive = new Set(["finalizado","cancelado"]);
const todayLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const dateBR=(v:string)=>v.split("-").reverse().join("/");
export default function KanbanProcessos({processes,clients,openProcess,changeStatus,goToProcesses}:{processes:Process[];clients:Client[];openProcess:(id:string)=>void;changeStatus:(id:string,status:string)=>void;goToProcesses:()=>void}) {
 const [search,setSearch]=useState("");const [showClosed,setShowClosed]=useState(false);const [dragged,setDragged]=useState<string|null>(null);const [hover,setHover]=useState<string|null>(null);
 const today=todayLocal();
 const names=useMemo(()=>new Map(clients.map(c=>[c.id,c.name])),[clients]);
 const filtered=useMemo(()=>processes.filter(p=>{
   const terms=[p.title,names.get(p.clientId),p.protocol,p.property,p.registry,p.location].join(" ").toLocaleLowerCase("pt-BR");
   return terms.includes(search.trim().toLocaleLowerCase("pt-BR"));
 }),[processes,names,search]);
 const shown=columns.filter(c=>showClosed||!inactive.has(c.id));
 const overdue=(p:Process)=>Boolean(p.deadline&&p.deadline<today&&!inactive.has(p.status||"preparacao"));
 const stats=[{name:"Processos ativos",value:processes.filter(p=>!inactive.has(p.status||"preparacao")).length,style:"border-sky-400"},{name:"Notas devolutivas",value:processes.filter(p=>p.status==="devolutiva").length,style:"border-orange-400"},{name:"Prazos vencidos",value:processes.filter(overdue).length,style:"border-rose-400"},{name:"Finalizados",value:processes.filter(p=>p.status==="finalizado").length,style:"border-emerald-400"}];
 function move(target:string){if(dragged){const p=processes.find(x=>x.id===dragged);if(p&&(p.status||"preparacao")!==target)changeStatus(dragged,target);}setDragged(null);setHover(null);}
 return <div className="space-y-5 text-slate-800">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#9b7951]">MW Despachante · Acompanhamento</p><h2 className="mt-1 text-2xl font-extrabold text-[#10234d]">Kanban de processos</h2><p className="mt-1 text-sm text-slate-500">Arraste os cartões entre etapas ou altere o status pelo seletor. Todas as mudanças ficam no histórico.</p></div><button type="button" onClick={goToProcesses} className="inline-flex items-center gap-2 rounded-xl bg-[#10234d] px-4 py-2.5 text-sm font-semibold text-white"><ClipboardList size={17}/>Lista de processos</button></div>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(s=><div key={s.name} className={"rounded-xl border border-l-4 bg-white p-4 shadow-sm "+s.style}><p className="text-xs text-slate-500">{s.name}</p><p className="mt-1 text-2xl font-extrabold text-[#10234d]">{s.value}</p></div>)}</div>
   <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><label className="relative min-w-[200px] flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar cliente, serviço, matrícula ou protocolo" aria-label="Pesquisar processos no Kanban" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#9b7951]"/></label><label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-700"><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)} className="size-4 accent-[#10234d]"/>Exibir finalizados e cancelados</label></div>
   <div className="overflow-x-auto pb-3"><div className="flex min-h-[420px] items-stretch gap-3">
    {shown.map(col=>{const cards=filtered.filter(p=>(p.status||"preparacao")===col.id).sort((a,b)=>(b.updatedAt||b.created).localeCompare(a.updatedAt||a.created));return <section key={col.id} aria-label={col.label} onDragOver={e=>{e.preventDefault();setHover(col.id);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setHover(null);}} onDrop={e=>{e.preventDefault();move(col.id);}} className={"w-[285px] min-w-[285px] max-w-[285px] flex-shrink-0 overflow-hidden rounded-2xl border bg-slate-50/90 transition-colors "+(hover===col.id?"border-blue-400 bg-blue-50":"border-slate-200")}>
     <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-3"><span className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800"><span className={"size-2.5 shrink-0 rounded-full "+col.line}/>{col.label}</span><span className={"rounded-full px-2 py-0.5 text-xs font-bold "+col.chip}>{cards.length}</span></div>
     <div className="max-h-[650px] min-h-[345px] space-y-3 overflow-y-auto p-2.5">{cards.map(p=><article key={p.id} draggable onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",p.id);setDragged(p.id);}} onDragEnd={()=>{setDragged(null);setHover(null);}} className={"rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md "+(dragged===p.id?"opacity-40":"")}>
       <div className="mb-2 flex items-start justify-between gap-1"><button type="button" onClick={()=>openProcess(p.id)} className="min-w-0 flex-1 text-left text-sm font-bold leading-snug text-[#10234d] hover:underline">{p.title}</button><GripVertical size={16} aria-label="Arrastar processo" className="mt-0.5 shrink-0 cursor-grab text-slate-400"/></div>
       <p className="mb-2 truncate text-xs font-semibold text-slate-700">{names.get(p.clientId)||"Cliente não encontrado"}</p>
       <div className="space-y-1 text-xs text-slate-500">{p.protocol&&<p className="truncate">Protocolo: {p.protocol}</p>}{p.property&&<p className="truncate" title={p.property}>Imóvel: {p.property}</p>}{p.location&&<p className="flex items-center gap-1 truncate"><MapPin size={12}/>{p.location}</p>}{p.nextAction&&<p className="line-clamp-2 text-slate-600" title={p.nextAction}>Próxima ação: {p.nextAction}</p>}</div>
       <div className="mt-3 flex flex-wrap gap-1.5">{p.deadline&&<span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold "+(overdue(p)?"bg-rose-100 text-rose-800":"bg-slate-100 text-slate-600")}>{overdue(p)?<AlertTriangle size={12}/>:<CalendarDays size={12}/>} {overdue(p)?"Vencido: ":"Prazo: "}{dateBR(p.deadline)}</span>}</div>
       <div className="mt-3 border-t border-slate-100 pt-3"><label className="block text-[11px] font-medium text-slate-500">Mudar etapa<select aria-label={"Alterar etapa de "+p.title} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800" value={p.status||"preparacao"} onChange={e=>changeStatus(p.id,e.target.value)}>{columns.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button type="button" onClick={()=>openProcess(p.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#846640]">Abrir dossiê <ArrowUpRight size={13}/></button></div>
     </article>)}{!cards.length&&<p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Nenhum processo nesta etapa</p>}</div>
   </section>})}
   </div></div>
 </div>;
}
