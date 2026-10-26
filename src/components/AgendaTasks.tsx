import { useEffect,useState } from "react";
import {Plus,Trash2,CheckSquare} from "lucide-react";
export type Task={id:string;title:string;date:string;category:string;status:"todo"|"doing"|"done"};
const stages=[["todo","A fazer"],["doing","Em andamento"],["done","Concluído"]] as const;
export default function TaskBoard({storageKey,date}: {storageKey:string;date:string}){
 const key=storageKey+":tasks";
 const [tasks,setTasks]=useState<Task[]>([]);
 const [name,setName]=useState("");
 const [scope,setScope]=useState<"day"|"all">("day");
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=JSON.parse(localStorage.getItem(key)||"[]");setTasks(Array.isArray(raw)?raw:[]);}catch{setTasks([]);}setReady(true);},[key]);
 useEffect(()=>{if(ready)localStorage.setItem(key,JSON.stringify(tasks));},[ready,tasks,key]);
 useEffect(()=>{const reload=()=>{try{const raw=JSON.parse(localStorage.getItem(key)||"[]");setTasks(Array.isArray(raw)?raw:[]);}catch{}};window.addEventListener("mw-agenda-tasks-refresh",reload);return()=>window.removeEventListener("mw-agenda-tasks-refresh",reload)},[key]);
 const visible=scope==="all"?tasks:tasks.filter(t=>t.date===date);
 const change=(id:string,status:Task["status"])=>setTasks(old=>old.map(t=>t.id===id?{...t,status}:t));
 return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-bold text-[#122452]"><CheckSquare size={20}/> Quadro de tarefas</h2><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setScope("day")}>Do dia</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setScope("all")}>Todas</button></div></div>
 <form onSubmit={e=>{e.preventDefault();if(!name.trim())return;setTasks(v=>[...v,{id:crypto.randomUUID(),title:name.trim(),date,category:"Geral",status:"todo"}]);setName("");}} className="flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Adicionar uma tarefa ou item de checklist"/><button className="rounded-lg bg-[#122452] px-3 text-white"><Plus size={18}/></button></form>
 <div className="grid gap-3 md:grid-cols-3">{stages.map(([status,label])=><div key={status} className="min-h-36 rounded-xl border border-slate-200 bg-[#f9fafb] p-3"><h3 className="mb-3 text-sm font-bold text-[#63513b]">{label} <span className="text-slate-400">({visible.filter(t=>t.status===status).length})</span></h3><div className="space-y-2">{visible.filter(t=>t.status===status).map(t=><div key={t.id} className="rounded-lg border bg-white p-3"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={t.status==="done"} onChange={e=>change(t.id,e.target.checked?"done":"todo")} className="mt-1 size-4 accent-[#a18357]"/><span className={t.status==="done"?"text-slate-400 line-through":"text-slate-800"}>{t.title}</span></label><div className="mt-2 flex items-center justify-between gap-2"><select aria-label="Etapa da tarefa" value={t.status} onChange={e=>change(t.id,e.target.value as Task["status"])} className="max-w-full rounded border border-slate-200 p-1 text-xs">{stages.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select><button type="button" aria-label="Excluir tarefa" className="text-red-500" onClick={()=>{if(confirm("Excluir tarefa?"))setTasks(x=>x.filter(a=>a.id!==t.id));}}><Trash2 size={15}/></button></div></div>)}</div></div>)}</div>
 </section>;
}
