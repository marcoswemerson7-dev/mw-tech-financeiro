import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FilePlus2, Printer, Plus, Trash2, UserRound, X } from "lucide-react";

type Template = { id: string; name: string; docs: string[] };
type RecordItem = { id: string; client: string; phone: string; title: string; templateId: string; docs: { name: string; checked: boolean }[]; notes: string; created: string };
const initialTemplates: Template[] = [
  { id: "rural", name: "Escritura Rural PF–PF", docs: ["RG e CPF das partes", "Certidão de estado civil", "Matrícula atualizada", "CCIR", "ITR", "CAR do imóvel"] },
];
const key = "mw-despachante-local-v1";
function makeId() { return crypto.randomUUID(); }
function readState(): { templates: Template[]; records: RecordItem[] } {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.templates) && Array.isArray(parsed.records)) return parsed;
    }
  } catch { /* local storage indisponível */ }
  return { templates: initialTemplates, records: [] };
}
export default function Despachante() {
  const [data, setData] = useState(readState);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("rural");
  const [templateName, setTemplateName] = useState("");
  const [documents, setDocuments] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(data)); setError(""); }
    catch { setError("Não foi possível salvar neste navegador. Verifique o espaço disponível."); }
  }, [data]);
  const current = data.records.find(r => r.id === selected);
  const rows = useMemo(() => data.records.filter(r => [r.client,r.title].some(x => x.toLocaleLowerCase("pt-BR").includes(filter.toLocaleLowerCase("pt-BR")))), [data.records,filter]);
  function createRecord(e: React.FormEvent) {
    e.preventDefault();
    const chosen = data.templates.find(t => t.id === templateId);
    if (!chosen || !client.trim() || !title.trim()) return;
    const next: RecordItem = { id: makeId(), client: client.trim(), phone: phone.trim(), title: title.trim(), templateId, docs: chosen.docs.map(name => ({ name, checked: false })), notes: "", created: new Date().toISOString() };
    setData(d => ({ ...d, records: [next,...d.records] }));
    setSelected(next.id); setClient(""); setPhone(""); setTitle("");
  }
  function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    const docs = documents.split("\n").map(s=>s.trim()).filter(Boolean);
    if (!templateName.trim() || !docs.length) return;
    const next = { id: makeId(), name: templateName.trim(), docs };
    setData(d=>({...d,templates:[...d.templates,next]}));
    setTemplateId(next.id); setTemplateName(""); setDocuments("");
  }
  function patchRecord(id: string, fn: (r:RecordItem)=>RecordItem) {
    setData(d=>({...d,records:d.records.map(r=>r.id===id?fn(r):r)}));
  }
  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-[#987d59]";
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#987d59]">MW TECH CONTROL</p><h1 className="text-2xl font-bold text-[#10234d]">MW Despachante</h1><p className="text-sm text-slate-500">Clientes, modelos de documentação e conferência de documentos.</p></div><ClipboardCheck className="text-[#987d59]" size={34}/></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Versão local inicial:</strong> os dados ficam somente neste navegador. Não utilize para guardar documentos ou dados sensíveis de clientes até ativarmos o banco de dados e as permissões de acesso. Os relatórios podem ser impressos ou salvos como PDF.</div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-4 md:grid-cols-3">{[{label:"Atendimentos",value:data.records.length},{label:"Em andamento",value:data.records.filter(r=>r.docs.some(x=>!x.checked)).length},{label:"Concluídos",value:data.records.filter(r=>r.docs.every(x=>x.checked)).length}].map(x=><div key={x.label} className={card}><span className="text-sm text-slate-500">{x.label}</span><p className="text-3xl font-bold text-[#10234d]">{x.value}</p></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={createRecord} className={card+" space-y-3"}><h2 className="flex items-center gap-2 text-lg font-bold"><UserRound size={20}/> Novo atendimento</h2>
        <label className="block text-sm font-medium">Nome do cliente<input className={field} value={client} onChange={e=>setClient(e.target.value)} required maxLength={160}/></label>
        <label className="block text-sm font-medium">Telefone<input className={field} value={phone} onChange={e=>setPhone(e.target.value)} maxLength={30}/></label>
        <label className="block text-sm font-medium">Serviço / assunto<input className={field} value={title} onChange={e=>setTitle(e.target.value)} required maxLength={160} placeholder="Ex.: Escritura rural"/></label>
        <label className="block text-sm font-medium">Modelo do checklist<select className={field} value={templateId} onChange={e=>setTemplateId(e.target.value)}>{data.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#10234d] px-5 py-3 text-sm font-semibold text-white"><Plus size={17}/> Cadastrar atendimento</button>
      </form>
      <form onSubmit={saveTemplate} className={card+" space-y-3"}><h2 className="flex items-center gap-2 text-lg font-bold"><FilePlus2 size={20}/> Criar modelo de checklist</h2>
        <label className="block text-sm font-medium">Nome do modelo<input className={field} value={templateName} onChange={e=>setTemplateName(e.target.value)} required maxLength={160} placeholder="Ex.: Inventário extrajudicial"/></label>
        <label className="block text-sm font-medium">Documentos (um por linha)<textarea className={field+" min-h-36"} value={documents} onChange={e=>setDocuments(e.target.value)} required placeholder={"RG e CPF\nCertidão de nascimento\nCertidão de óbito"}/></label>
        <button className="inline-flex items-center gap-2 rounded-xl border border-[#10234d] px-5 py-3 text-sm font-semibold text-[#10234d]"><Plus size={17}/> Salvar modelo</button>
      </form>
    </div>
    <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Atendimentos cadastrados</h2><input className={field+" !mt-0 max-w-xs"} placeholder="Buscar cliente ou serviço" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
      {!rows.length ? <p className="text-sm text-slate-500">Nenhum atendimento encontrado.</p> : <div className="space-y-2">{rows.map(r=>{const done=r.docs.filter(d=>d.checked).length;return <button key={r.id} onClick={()=>setSelected(r.id)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"><span><strong className="block text-sm">{r.client}</strong><small className="text-slate-500">{r.title}</small></span><span className="text-sm font-semibold text-[#987d59]">{done}/{r.docs.length} documentos</span></button>})}</div>}
    </section>
    {current && <section className={card+" space-y-4"}><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Conferência de documentação</p><h2 className="text-xl font-bold">{current.client}</h2><p className="text-sm text-slate-500">{current.title} · {current.phone || "Sem telefone"}</p></div><button aria-label="Fechar atendimento" onClick={()=>setSelected("")}><X/></button></div>
      <div className="space-y-2">{current.docs.map((doc,i)=><label key={i} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm"><input className="size-5 accent-[#987d59]" type="checkbox" checked={doc.checked} onChange={e=>patchRecord(current.id,r=>({...r,docs:r.docs.map((d,j)=>j===i?{...d,checked:e.target.checked}:d)}))}/><span>{doc.name}</span></label>)}</div>
      <label className="block text-sm font-medium">Observações<textarea className={field} rows={3} value={current.notes} onChange={e=>patchRecord(current.id,r=>({...r,notes:e.target.value}))}/></label>
      <div className="flex flex-wrap gap-2"><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#10234d] px-4 py-2.5 text-sm font-semibold text-white"><Printer size={17}/> Imprimir / salvar PDF</button><button onClick={()=>{if(window.confirm("Excluir este atendimento?")){setData(d=>({...d,records:d.records.filter(r=>r.id!==current.id)}));setSelected("");}}} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-700"><Trash2 size={17}/> Excluir</button></div>
    </section>}
    {current && <div className="despachante-print hidden"><header><div className="despachante-monogram">MW</div><strong>MW DESPACHANTE IMOBILIÁRIO</strong></header><article><div className="despachante-watermark">MW</div><h1>CHECKLIST DE DOCUMENTAÇÃO</h1><p><b>Cliente:</b> {current.client}</p><p><b>Serviço:</b> {current.title}</p><p><b>Telefone:</b> {current.phone || "—"}</p><p><b>Data:</b> {new Date(current.created).toLocaleDateString("pt-BR")}</p><table><thead><tr><th>Documento</th><th>Situação</th></tr></thead><tbody>{current.docs.map((d,i)=><tr key={i}><td>{d.name}</td><td>{d.checked?"Recebido":"Pendente"}</td></tr>)}</tbody></table><p><b>Observações:</b> {current.notes || "—"}</p></article><footer>(89) 9 9930-8209 · despachantemarcoswemerson@gmail.com · marcoswemerson7@gmail.com<br/>Ribeiro Gonçalves–PI · Baixa Grande do Ribeiro–PI</footer></div>}
    <style>{`@media print { body * {visibility:hidden!important} .despachante-print,.despachante-print * {visibility:visible!important} .despachante-print {display:flex!important;position:absolute;inset:0;width:100%;min-height:100vh;flex-direction:column;font:12px Arial,sans-serif;color:#10234d;background:white} .despachante-print header {height:115px;background:#10234d;color:#e7b08c;padding:20px 36px;display:flex;align-items:center;gap:20px} .despachante-monogram {font-size:48px;font-weight:800} .despachante-print article {flex:1;position:relative;padding:35px 45px;overflow:hidden} .despachante-print h1 {font-size:20px;position:relative} .despachante-print article p,.despachante-print table {position:relative} .despachante-print table {border-collapse:collapse;width:100%;margin:30px 0}.despachante-print td,.despachante-print th{border-bottom:1px solid #ddd;text-align:left;padding:10px}.despachante-watermark{position:absolute;right:-70px;top:90px;font-size:300px;opacity:.07;font-weight:900;color:#e7b08c;transform:rotate(-15deg)}.despachante-print footer{background:#806d49;color:white;padding:20px 35px;line-height:1.6;font-size:11px}@page {size:A4;margin:0} } `}</style>
  </div>;
}
