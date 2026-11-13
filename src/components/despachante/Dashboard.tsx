import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, FileWarning, FolderOpen, Plus, Users, ChevronRight, Activity, Layers3, FileText, BarChart3 } from 'lucide-react';

type Item = { id: string; clientId: string; title: string; created: string; updatedAt?: string; status?: string; deadline?: string; nextAction?: string; location?: string; history?: { id: string; at: string; title: string; text: string }[] };
type Checklist = Item & { docs: { checked: boolean; status?: string }[] };
type Client = { id: string; name: string };
type Section = 'processos' | 'atendimentos' | 'clientes' | 'modelos';

const states = [
  { key: 'preparacao', label: 'Em preparação', color: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' },
  { key: 'protocolado', label: 'Protocolado', color: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700' },
  { key: 'analise', label: 'Em análise', color: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700' },
  { key: 'devolutiva', label: 'Nota devolutiva', color: 'bg-orange-500', badge: 'bg-orange-50 text-orange-800' },
  { key: 'cliente', label: 'Aguardando cliente', color: 'bg-amber-400', badge: 'bg-amber-50 text-amber-800' },
  { key: 'finalizado', label: 'Finalizado', color: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  { key: 'cancelado', label: 'Cancelado', color: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600' },
];
const closed = (p: Item) => p.status === 'finalizado' || p.status === 'cancelado';
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateFromIso = (date: string) => new Date(date + 'T12:00:00');
const received = (doc: Checklist['docs'][number]) => doc.status !== 'dispensado' && (doc.status === 'recebido' || doc.checked);
const panel = 'min-w-0 overflow-hidden rounded-[20px] border border-[#e1e7ef] bg-white shadow-[0_8px_28px_rgba(12,35,62,0.055)]';
const action = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[#8c642b] transition hover:bg-amber-50';
const title = 'text-[15px] font-bold tracking-[-0.02em] text-[#10233b] sm:text-base';

function Empty({ title, text }: { title: string; text: string }) {
 return <div className="flex min-h-[180px] flex-col items-center justify-center px-5 py-8 text-center"><span className="mb-3 grid size-11 place-items-center rounded-2xl bg-slate-50 text-slate-300"><FolderOpen size={22}/></span><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-500">{text}</p></div>;
}

export default function Dashboard({ processes, checklists, clients, navigate, openProcess, openChecklist, now = new Date() }: { processes: Item[]; checklists: Checklist[]; clients: Client[]; navigate: (section: Section) => void; openProcess: (id: string) => void; openChecklist: (id: string) => void; now?: Date }) {
 const today = localDay(now);
 const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7);
 const weekEnd = localDay(nextWeek);
 const active = processes.filter(p => !closed(p));
 const overdue = active.filter(p => p.deadline && p.deadline < today);
 const priorities = active.filter(p => p.deadline && p.deadline <= weekEnd).sort((a,b) => a.deadline!.localeCompare(b.deadline!));
 const clientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente não encontrado';
 const recent = [...processes].sort((a,b) => (b.updatedAt || b.created).localeCompare(a.updatedAt || a.created)).slice(0,3);
 const documentTotal = checklists.reduce((sum,c) => sum + c.docs.filter(d => d.status !== 'dispensado').length, 0);
 const documentsReceived = checklists.reduce((sum,c) => sum + c.docs.filter(received).length, 0);
 const pending = Math.max(0,documentTotal - documentsReceived);
 const dispensed = checklists.reduce((sum,c) => sum + c.docs.filter(d => d.status === 'dispensado').length, 0);
 const allDocuments = documentTotal + dispensed;
 const receivedAngle = allDocuments ? documentsReceived / allDocuments * 360 : 0;
 const pendingAngle = allDocuments ? (documentsReceived + pending) / allDocuments * 360 : 0;
 const documentaryChart = allDocuments
  ? `conic-gradient(#c79a50 0deg ${receivedAngle}deg, #f59e0b ${receivedAngle}deg ${pendingAngle}deg, #cbd5e1 ${pendingAngle}deg 360deg)`
  : 'conic-gradient(#e2e8f0 0deg 360deg)';
 const months = Array.from({length:6},(_,i)=>{
  const date=new Date(now.getFullYear(),now.getMonth()-5+i,1);
  const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  return {key,label:date.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),count:processes.filter(p=>typeof p.created==='string'&&p.created.slice(0,7)===key).length};
 });
 const monthlyMax = Math.max(1,...months.map(m=>m.count));
 const recentMonth = months[months.length-1]?.count ?? 0;
 const percent = documentTotal ? Math.round(documentsReceived/documentTotal*100) : 0;
 const unfinishedChecklists = checklists.map(c => ({ ...c, pending: c.docs.filter(d => d.status !== 'dispensado' && !received(d)).length })).filter(c => c.pending > 0);
 const pendingChecklists = [...unfinishedChecklists].sort((a,b) => b.pending-a.pending).slice(0,3);
 const stats = [
  {label:'Processos em andamento',value:active.length,detail:'Processos ativos na carteira',Icon:FolderOpen, icon:'bg-amber-50 text-[#aa792e]',border:'hover:border-amber-300',to:'processos' as Section},
  {label:'Com exigências',value:active.filter(p=>p.status==='devolutiva').length,detail:'Notas devolutivas',Icon:FileWarning,icon:'bg-orange-50 text-orange-600',border:'hover:border-orange-300',to:'processos' as Section},
  {label:'Prazos vencidos',value:overdue.length,detail:'Providências em atraso',Icon:Clock3,icon:'bg-rose-50 text-rose-600',border:'hover:border-rose-300',to:'processos' as Section},
  {label:'Checklists pendentes',value:unfinishedChecklists.length,detail:`${pending} documentos pendentes`,Icon:ClipboardCheck,icon:'bg-emerald-50 text-emerald-600',border:'hover:border-emerald-300',to:'atendimentos' as Section},
 ];
 return <div className="w-full min-w-0 space-y-5 pb-8">
  <section className="relative isolate overflow-hidden rounded-[22px] bg-[linear-gradient(115deg,#08213a_0%,#10385b_64%,#0c2b49_100%)] text-white shadow-[0_12px_30px_rgba(9,33,58,.16)]">
   <div aria-hidden="true" className="pointer-events-none absolute right-[12%] -bottom-[100px] -z-10 h-[260px] w-[260px] rotate-45 rounded-[34px] border border-[#d6af70]/40 bg-gradient-to-br from-white/10 to-transparent shadow-[28px_-28px_0_-26px_#d5ab6b,62px_-62px_0_-58px_#d5ab6b]"/>
   <div aria-hidden="true" className="pointer-events-none absolute right-[-70px] top-[-150px] -z-10 size-[320px] rounded-full border border-white/10"/>
   <div className="flex flex-wrap items-center justify-between gap-6 px-5 py-7 sm:px-8 sm:py-8">
    <div className="max-w-[600px]">
     <div className="mb-2 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#e5bf7d]"/><p className="text-[10px] font-extrabold uppercase tracking-[.23em] text-[#e4c18a]">Painel do escritório</p></div>
     <h2 className="text-[25px] font-extrabold tracking-[-0.035em] sm:text-[31px]">Visão geral do escritório</h2>
     <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-200">Acompanhe processos, prazos, movimentações e a documentação imobiliária em um só lugar.</p>
     <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-300"><span className="inline-flex items-center gap-2"><Users size={14} className="text-[#e4c18a]"/>{clients.length} clientes</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-[#e4c18a]"/>{processes.filter(p=>p.status==='finalizado').length} processos finalizados</span><span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-[#e4c18a]"/>{now.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</span></div>
    </div>
    <div className="flex w-full shrink-0 flex-row flex-wrap gap-2 sm:w-auto sm:min-w-[190px] sm:flex-col">
     <button onClick={()=>navigate('processos')} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e9c98d] to-[#d4aa62] px-4 py-2.5 text-xs font-extrabold text-[#122941] shadow-sm transition hover:brightness-105"><FolderOpen size={17}/>Gerenciar processos<ArrowRight size={15}/></button>
     <button onClick={()=>navigate('atendimentos')} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"><Plus size={16}/>Novo checklist</button>
    </div>
   </div>
  </section>

  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((s,i)=><button key={s.label} onClick={()=>navigate(s.to)} className={panel+' group flex min-h-[115px] items-center gap-3.5 border-l-[3px] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg '+s.border+(i===0?' border-l-[#caa15f]': ' border-l-transparent')}>
   <span className={'grid size-12 shrink-0 place-items-center rounded-2xl '+s.icon}><s.Icon size={22}/></span>
   <span className="min-w-0 flex-1"><span className="block text-[30px] font-extrabold leading-none tabular-nums tracking-tight text-[#10243d]">{s.value}</span><span className="mt-2 block text-xs font-bold leading-5 text-[#26384c]">{s.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{s.detail}</span></span>
   <ChevronRight size={15} className="self-start text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#aa792e]"/>
  </button>)}</div>

  <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-5">
   <section className={panel+' lg:col-span-3'}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f5] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#ad7b32]"><CalendarDays size={20}/></span><div><h3 className={title}>Agenda de providências</h3><p className="mt-0.5 text-[11px] text-slate-500">Prazos vencidos e próximos 7 dias</p></div></div><span className="rounded-full bg-[#f2f5fa] px-3 py-1.5 text-[11px] font-bold text-[#587086]">{priorities.length} processo(s)</span></div>
    {priorities.length?<div className="divide-y divide-[#eef1f5]">{priorities.slice(0,5).map(p=>{const overdueItem=!!p.deadline&&p.deadline<today;const d=dateFromIso(p.deadline!);return <button key={p.id} onClick={()=>openProcess(p.id)} className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[#f8fafc] sm:px-6"><span className={'flex size-[47px] shrink-0 flex-col items-center justify-center rounded-xl '+(overdueItem?'bg-red-50 text-red-700':'bg-[#faf3e7] text-[#9d6c25]')}><span className="text-[18px] font-extrabold leading-none">{d.getDate()}</span><span className="mt-0.5 text-[10px] font-bold uppercase">{d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</span></span><span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-bold text-[#193047]">{p.nextAction||p.title}</span><span className="mt-1 block break-words text-[11px] text-slate-500">{clientName(p.clientId)} · {p.title}</span></span><span className={'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold '+(overdueItem?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700')}>{overdueItem?'Vencido':p.deadline===today?'Hoje':'Próximo'}</span><ChevronRight size={16} className="shrink-0 text-slate-400 group-hover:text-[#a97834]"/></button>})}</div>:<Empty title="Nenhum prazo próximo cadastrado" text="Cadastre o prazo e a próxima providência nos processos para acompanhar sua agenda aqui."/>}
    <div className="border-t border-[#edf0f5] px-4 py-2 sm:px-5"><button onClick={()=>navigate('processos')} className={action}>Ver todos os processos<ArrowRight size={14}/></button></div>
   </section>
   <section className={panel+' lg:col-span-2'}>
    <div className="flex items-center gap-3 border-b border-[#edf0f5] px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#ad7b32]"><Activity size={20}/></span><div><h3 className={title}>Situação dos processos</h3><p className="mt-0.5 text-[11px] text-slate-500">Distribuição por etapa · {processes.length} no total</p></div></div>
    <div className="space-y-3 px-5 py-5">{states.map(s=>{const count=processes.filter(p=>(p.status||'preparacao')===s.key).length;return <div key={s.key} className="grid grid-cols-[minmax(94px,130px)_minmax(0,1fr)_24px] items-center gap-3"><span className="text-[11px] font-medium leading-4 text-slate-600">{s.label}</span><div className="h-2.5 overflow-hidden rounded-full bg-[#eef1f5]"><div className={'h-full rounded-full transition-all '+s.color} style={{width:`${processes.length?count/processes.length*100:0}%`}}/></div><span className="text-right text-xs font-bold tabular-nums text-[#142c45]">{count}</span></div>})}</div>
   </section>
  </div>

  <section className={panel}>
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f5] px-5 py-4 sm:px-6">
    <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#ad7b32]"><BarChart3 size={20}/></span><div><h3 className={title}>Evolução mensal de processos</h3><p className="mt-0.5 text-[11px] text-slate-500">Novos processos cadastrados nos últimos 6 meses</p></div></div>
    <div className="flex items-center gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2"><span className="size-2 rounded-full bg-[#c79a50]"/><span className="text-[11px] text-slate-600">Mês atual</span><strong className="ml-1 text-sm tabular-nums text-[#10243d]">{recentMonth}</strong></div>
   </div>
   <div className="px-5 pb-5 pt-4 sm:px-6">
    <div className="grid h-[156px] grid-cols-6 items-end gap-2 border-b border-[#e8edf4] sm:gap-5">
     {months.map((m,i)=><div key={m.key} className="group flex h-full min-w-0 flex-col items-center justify-end gap-1.5" title={`${m.count} processo(s) em ${m.label}`}>
      <span className="text-[11px] font-bold tabular-nums text-[#3e5368]">{m.count}</span>
      <div className="flex h-[111px] w-full max-w-[85px] items-end rounded-t-lg bg-[#f3f6fa]">
       <div className={'w-full rounded-t-lg transition-all duration-300 '+(i===months.length-1?'bg-[#c79a50]':'bg-[#547d9f] group-hover:bg-[#254f73]')} style={{height:`${m.count ? Math.max(8,m.count/monthlyMax*100):0}%`}}/>
      </div>
     </div>)}
    </div>
    <div className="mt-2 grid grid-cols-6 gap-2 sm:gap-5">{months.map(m=><div key={m.key} className="text-center text-[11px] font-semibold uppercase text-slate-500">{m.label}</div>)}</div>
    <p className="mt-3 text-[11px] text-slate-400">Contagem baseada na data de cadastro de cada processo, sem incluir checklists.</p>
   </div>
  </section>

  <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-5">
   <section className={panel+' lg:col-span-3'}>
    <div className="flex items-center justify-between gap-3 border-b border-[#edf0f5] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#ad7b32]"><Layers3 size={20}/></span><div><h3 className={title}>Processos atualizados</h3><p className="mt-0.5 text-[11px] text-slate-500">Últimas 3 movimentações da carteira</p></div></div><button onClick={()=>navigate('processos')} className={action}>Ver todos<ArrowRight size={14}/></button></div>
    {recent.length?<div className="divide-y divide-[#edf0f5]">{recent.map(p=>{const status=states.find(s=>s.key===(p.status||'preparacao'))||states[0];return <button key={p.id} onClick={()=>openProcess(p.id)} className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[#f8fafc] sm:px-6"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#e9edf3] bg-slate-50 text-[#60718b]"><FileText size={17}/></span><span className="min-w-0 flex-1"><span className="block break-words text-[12px] font-bold leading-5 text-[#193047]">{p.title}</span><span className="mt-0.5 block break-words text-[11px] text-slate-500">{clientName(p.clientId)} <span className="mx-1 text-slate-300">|</span> {p.location||'Escritório'}</span></span><span className={'hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex '+status.badge}>{status.label}</span><span className="hidden shrink-0 text-[10px] text-slate-400 lg:block">{new Date(p.updatedAt||p.created).toLocaleDateString('pt-BR')}</span><ChevronRight size={16} className="shrink-0 text-slate-400 group-hover:text-[#a97834]"/></button>})}</div>:<Empty title="Sua carteira começa aqui" text="Cadastre um processo para acompanhar protocolos, locais e movimentações."/>}
   </section>
   <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
    <section className={panel}>
     <div className="flex items-center gap-3 border-b border-[#edf0f5] px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#ad7b32]"><ClipboardCheck size={20}/></span><div><h3 className={title}>Conferência documental</h3><p className="mt-0.5 text-[11px] text-slate-500">Progresso dos documentos exigíveis</p></div></div>
     <div className="flex flex-col items-center gap-5 px-5 py-5 sm:flex-row">
      <div role="img" aria-label={`${documentsReceived} documentos recebidos, ${pending} pendentes e ${dispensed} dispensados`} className="relative grid size-[134px] shrink-0 place-items-center rounded-full" style={{background:documentaryChart}}>
       <div className="flex size-[94px] flex-col items-center justify-center rounded-full bg-white text-center"><strong className="text-[28px] font-extrabold leading-none tabular-nums tracking-tight text-[#10243d]">{percent}%</strong><span className="mt-1 text-[10px] text-slate-500">recebidos</span></div>
      </div>
      <div className="w-full min-w-0 flex-1 space-y-2.5">
       <div className="flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-sm bg-[#c79a50]"/>Recebidos</span><strong className="tabular-nums text-[#10243d]">{documentsReceived}</strong></div>
       <div className="flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-sm bg-amber-500"/>Pendentes</span><strong className="tabular-nums text-[#10243d]">{pending}</strong></div>
       <div className="flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-sm bg-slate-300"/>Dispensados</span><strong className="tabular-nums text-[#10243d]">{dispensed}</strong></div>
       <p className="border-t border-[#edf0f5] pt-2 text-[11px] text-slate-500">{allDocuments} itens cadastrados · {documentTotal} exigíveis</p>
      </div>
     </div>
    </section>
    <section className={panel+' flex-1'}>
     <div className="flex items-center gap-3 border-b border-[#edf0f5] px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-[#ad7b32]"><Users size={20}/></span><div><h3 className={title}>Pendências documentais</h3><p className="mt-0.5 text-[11px] text-slate-500">Checklists que precisam de atenção</p></div></div>
     {pendingChecklists.length?<div className="divide-y divide-[#edf0f5]">{pendingChecklists.map(c=><button key={c.id} onClick={()=>openChecklist(c.id)} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#f8fafc]"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><FileText size={15}/></span><span className="min-w-0 flex-1"><span className="block break-words text-[11px] font-bold text-[#1a3048]">{clientName(c.clientId)}</span><span className="mt-0.5 block break-words text-[10px] text-slate-500">{c.title}</span></span><span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">{c.pending} pend.</span><ChevronRight size={14} className="text-slate-400 group-hover:text-[#a97834]"/></button>)}</div>:<div className="px-5 py-5 text-xs text-slate-500">Nenhum checklist com pendências.</div>}
     <div className="border-t border-[#edf0f5] px-4 py-2"><button onClick={()=>navigate('atendimentos')} className={action}>Abrir checklists<ArrowRight size={14}/></button></div>
    </section>
   </div>
  </div>
 </div>;
}
