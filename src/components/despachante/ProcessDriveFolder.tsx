import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, Link2, ExternalLink, Save, Eye, EyeOff, Info, ShieldCheck, UploadCloud, Plus, Trash2, FileText, X, Maximize2, Minimize2, Search } from "lucide-react";

export type DriveEntry={id:string;name:string;url:string;kind:"file"|"folder"};
type Props={value?:string;onSave:(value:string)=>void;items?:DriveEntry[];onSaveItems:(items:DriveEntry[])=>void};

function googleLink(raw:string):{id:string;kind:"file"|"folder";preview:string;url:string}|null{
 try{
  const u=new URL(raw.trim());
  if(u.protocol!=="https:"||!["drive.google.com","docs.google.com"].includes(u.hostname))return null;
  let id="",kind:"file"|"folder"="file",preview="";
  if(u.hostname==="drive.google.com"){
   const folder=u.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})\/?$/);
   const file=u.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]{10,})(?:\/[^?#]*)?$/);
   if(folder){id=folder[1];kind="folder";}
   else if(file)id=file[1];
   else if(u.pathname==="/open"&&u.searchParams.has("id"))id=u.searchParams.get("id")||"";
   else return null;
   if(!/^[a-zA-Z0-9_-]{10,}$/.test(id))return null;
   const resourceKey=u.searchParams.get("resourcekey")||"";
   preview=kind==="folder"?"https://drive.google.com/embeddedfolderview?id="+encodeURIComponent(id)+(resourceKey?"&resourcekey="+encodeURIComponent(resourceKey):"")+"#list":"https://drive.google.com/file/d/"+encodeURIComponent(id)+"/preview"+(resourceKey?"?resourcekey="+encodeURIComponent(resourceKey):"");
  }else{
   const m=u.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]{10,})(?:\/[^?#]*)?$/);
   if(!m)return null;
   id=m[2];
   preview="https://docs.google.com/"+m[1]+"/d/"+encodeURIComponent(id)+"/preview";
  }
  return {id,kind,preview,url:u.toString()};
 }catch{return null;}
}
const input="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#9b7951]";
export default function ProcessDriveFolder({value,onSave,items=[],onSaveItems}:Props){
 const [draft,setDraft]=useState(value||"");
 const [showEmbed,setShowEmbed]=useState(false);
 const [notice,setNotice]=useState("");
 const [adding,setAdding]=useState(false);
 const [name,setName]=useState(""),[link,setLink]=useState("");
 const [search,setSearch]=useState("");
 const [viewer,setViewer]=useState<{name:string;preview:string;url:string;kind:"file"|"folder"}|null>(null);
 const [full,setFull]=useState(false);
 const root=googleLink(value||"");
 const proposed=googleLink(draft);
 function close(){setViewer(null);setFull(false);}
 useEffect(()=>{if(!viewer)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[viewer]);
 function save(){
  if(draft.trim()&&(!proposed||proposed.kind!=="folder")){setNotice("Use o link de uma pasta do Google Drive (drive.google.com/drive/folders/...).");return;}
  onSave(draft.trim());setNotice(draft.trim()?"Pasta vinculada ao processo.":"Vínculo com a pasta removido.");setShowEmbed(false);
 }
 function saveLink(){
  const parsed=googleLink(link);
  if(!name.trim()||!parsed){setNotice("Informe um nome e um link válido de arquivo ou pasta do Google Drive.");return;}
  if(items.some(item=>item.url===parsed.url)){setNotice("Este link já foi registrado neste processo.");return;}
  onSaveItems([...items,{id:crypto.randomUUID(),name:name.trim().slice(0,160),url:parsed.url,kind:parsed.kind}]);
  setName("");setLink("");setAdding(false);setNotice("Atalho incluído neste processo. Clique em Visualizar para abrir aqui.");
 }
 function remove(id:string){
  if(!confirm("Remover este atalho do processo? O arquivo continuará no Google Drive."))return;
  onSaveItems(items.filter(item=>item.id!==id));
  setNotice("Atalho removido. Nenhum arquivo foi excluído do Drive.");
 }
 function open(name:string,url:string){
  const parsed=googleLink(url);
  if(!parsed){setNotice("Este link não é mais válido.");return;}
  setFull(false);setViewer({name,preview:parsed.preview,url:parsed.url,kind:parsed.kind});
 }
 const visible=items.filter(item=>(item.name+" "+item.kind).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><FolderOpen size={22}/></span><div><h3 className="text-base font-bold text-[#10234d]">Pasta do Google Drive</h3><p className="mt-1 text-sm text-slate-500">Gerencie os links dos arquivos e subpastas deste processo, sem API.</p></div></div>
  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs leading-5 text-slate-700"><Info size={15} className="mr-1 inline align-text-bottom"/>A lista incorporada pertence ao Google e pode abrir novas abas ao clicar. Para visualizar documentos e subpastas na lateral, cadastre o link deles abaixo. Não é necessário deixar os documentos públicos: o acesso depende das permissões da conta Google.</div>
  <label className="block text-sm font-semibold text-[#10234d]">Link da pasta deste processo<input type="url" autoComplete="off" value={draft} onChange={e=>{setDraft(e.target.value);setNotice("");}} placeholder="https://drive.google.com/drive/folders/..." className={"mt-2 "+input}/></label>
  <div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={draft.trim()===(value||"").trim()||Boolean(draft.trim()&&(!proposed||proposed.kind!=="folder"))} className="inline-flex items-center gap-2 rounded-lg bg-[#10234d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Save size={16}/>Salvar vínculo</button>{root?.kind==="folder"&&<><button type="button" onClick={()=>open("Pasta principal do processo",value||"")} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800"><Eye size={15}/>Visualizar pasta na lateral</button><a target="_blank" rel="noopener noreferrer" href={root.url} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"><UploadCloud size={15}/>Adicionar arquivos pelo Drive</a><button type="button" onClick={()=>setShowEmbed(x=>!x)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold">{showEmbed?<EyeOff size={15}/>:<Eye size={15}/>} {showEmbed?"Ocultar lista incorporada":"Mostrar lista incorporada"}</button></>}</div>
  {notice&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-700">{notice}</p>}
  {root?.kind==="folder"?<div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs font-semibold text-emerald-800"><ShieldCheck size={16}/>Pasta do processo vinculada</div>:<div className="rounded-xl border border-dashed border-slate-200 p-5 text-center"><Link2 className="mx-auto mb-2 text-slate-400"/><p className="text-sm text-slate-500">Cole e salve o link da pasta do processo.</p></div>}
  <section className="overflow-hidden rounded-xl border border-slate-200">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3"><div><h4 className="text-sm font-bold text-[#10234d]">Arquivos e subpastas para visualização interna</h4><p className="mt-1 text-xs text-slate-500">Atalhos vinculados ao processo. Não são cópias dos arquivos.</p></div><button type="button" onClick={()=>setAdding(x=>!x)} className="inline-flex items-center gap-2 rounded-lg bg-[#10234d] px-3 py-2 text-xs font-bold text-white"><Plus size={15}/>Adicionar link</button></div>
   {adding&&<div className="grid gap-3 border-b border-slate-100 bg-blue-50/30 p-4"><label className="text-xs font-semibold text-slate-700">Nome do documento ou pasta<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Certidão de inteiro teor" maxLength={160} className={"mt-1 "+input}/></label><label className="text-xs font-semibold text-slate-700">Link compartilhado do Google Drive<input value={link} onChange={e=>setLink(e.target.value)} placeholder="Cole o link do arquivo ou subpasta" className={"mt-1 "+input}/></label><div className="flex gap-2"><button type="button" onClick={saveLink} className="rounded-lg bg-[#10234d] px-4 py-2 text-xs font-bold text-white">Salvar atalho</button><button type="button" onClick={()=>setAdding(false)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button></div></div>}
   {items.length>3&&<label className="relative block border-b p-3"><Search size={15} className="absolute left-6 top-6 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Pesquisar arquivos vinculados" placeholder="Pesquisar arquivos e pastas" className={input+" pl-9"}/></label>}
   {!visible.length?<p className="p-6 text-center text-sm text-slate-400">{items.length?"Nenhum item encontrado.":"Adicione links individuais para visualizar arquivos aqui dentro."}</p>:<div className="divide-y divide-slate-100">{visible.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="flex min-w-0 items-center gap-2">{item.kind==="folder"?<FolderOpen size={18} className="shrink-0 text-amber-600"/>:<FileText size={18} className="shrink-0 text-blue-700"/>}<p className="min-w-0 break-words text-sm font-semibold text-slate-800">{item.name}</p></div><div className="flex gap-2"><button type="button" onClick={()=>open(item.name,item.url)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"><Eye size={14}/>Visualizar</button><button type="button" onClick={()=>remove(item.id)} aria-label={"Remover atalho "+item.name} className="rounded-lg border border-red-100 px-2 py-2 text-red-600"><Trash2 size={15}/></button></div></div>)}</div>}
  </section>
  {root?.kind==="folder"&&showEmbed&&<div className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2"><span className="text-xs font-semibold text-slate-700">Lista incorporada do Google Drive</span><span className="text-xs text-slate-500">Os cliques nesta lista são controlados pelo Google</span></div><iframe title="Arquivos da pasta do Google Drive" src={root.preview} className="h-[440px] w-full bg-white sm:h-[550px]" referrerPolicy="strict-origin-when-cross-origin"/></div>}
  {viewer&&createPortal(<div className="fixed inset-0 z-[9999] flex justify-end bg-slate-950/60" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><aside role="dialog" aria-modal="true" aria-label={"Visualização de "+viewer.name} className={"flex h-full flex-col bg-white shadow-2xl "+(full?"w-full":"w-full sm:w-[min(900px,88vw)]")}><header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 sm:px-5"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-[#9b7951]">MW Despachante · Google Drive</p><h3 className="truncate text-sm font-bold text-[#10234d]" title={viewer.name}>{viewer.name}</h3></div><div className="flex shrink-0 items-center gap-1.5"><a href={viewer.url} target="_blank" rel="noopener noreferrer" title="Abrir no Google Drive" className="rounded-lg border p-2"><ExternalLink size={17}/></a><button type="button" onClick={()=>setFull(x=>!x)} title={full?"Reduzir":"Ampliar"} className="rounded-lg border p-2">{full?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button type="button" onClick={close} aria-label="Fechar" className="rounded-lg border p-2"><X size={19}/></button></div></header><div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-3"><iframe key={viewer.preview} src={viewer.preview} title={viewer.name} className="h-full w-full rounded-lg border border-slate-200 bg-white" referrerPolicy="strict-origin-when-cross-origin"/></div><div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">A visualização depende das permissões do Google Drive. Se o Google impedir a incorporação, use o ícone para abrir no Drive.</div></aside></div>,document.body)}
 </section>;
}
