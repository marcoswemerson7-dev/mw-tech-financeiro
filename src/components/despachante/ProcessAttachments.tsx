import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Upload, Trash2, RefreshCw, Paperclip, Eye, Download, X, Maximize2, Minimize2, LoaderCircle } from "lucide-react";
import {listProcessAttachments,uploadProcessAttachment,openProcessAttachment,deleteProcessAttachment,type ProcessAttachment} from "../../services/despachanteAttachments";

type Preview = { item: ProcessAttachment; url: string; kind: "pdf"|"image"|"other" };
const extension = (name:string) => name.toLowerCase().split(".").pop() || "";
const previewKind=(item:ProcessAttachment):Preview["kind"]=>{
 const ext=extension(item.name);
 if(ext==="pdf"||item.contentType==="application/pdf")return "pdf";
 if(["jpg","jpeg","png","webp"].includes(ext)||item.contentType.startsWith("image/"))return "image";
 return "other";
};
export default function ProcessAttachments({processId}:{processId:string}){
 const [files,setFiles]=useState<ProcessAttachment[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[loading,setLoading]=useState(true);
 const [preview,setPreview]=useState<Preview|null>(null),[previewBusy,setPreviewBusy]=useState(false),[expanded,setExpanded]=useState(false);
 const currentURL=useRef<string|null>(null);
 const requestId=useRef(0);
 function release(){if(currentURL.current){URL.revokeObjectURL(currentURL.current);currentURL.current=null;}}
 function close(){requestId.current++;setPreview(null);setPreviewBusy(false);setExpanded(false);release();}
 useEffect(()=>()=>{requestId.current++;release();},[]);
 useEffect(()=>{close();},[processId]);
 useEffect(()=>{if(!preview&&!previewBusy)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[preview,previewBusy]);
 async function refresh(){setLoading(true);try{setFiles(await listProcessAttachments(processId));setMessage("");}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[processId]);
 async function upload(selected:FileList|null){if(!selected?.length)return;setBusy(true);try{for(const file of Array.from(selected)){if(file.size>10*1024*1024)throw Error(file.name+": limite de 10 MB por arquivo.");await uploadProcessAttachment(processId,file);}await refresh();setMessage("Anexo(s) salvo(s) no Supabase com sucesso.");}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function view(item:ProcessAttachment){
  close();const id=++requestId.current;setPreviewBusy(true);
  try{
   const signed=await openProcessAttachment(processId,item.key);
   const response=await fetch(signed);
   if(!response.ok)throw Error("Não foi possível carregar o arquivo ("+response.status+").");
   const blob=await response.blob();
   if(id!==requestId.current)return;
   const url=URL.createObjectURL(blob);currentURL.current=url;
   setPreview({item,url,kind:previewKind(item)});
  }catch(e){if(id===requestId.current)setMessage(e instanceof Error?e.message:String(e));}
  finally{if(id===requestId.current)setPreviewBusy(false);}
 }
 function download(){if(!preview)return;const a=document.createElement("a");a.href=preview.url;a.download=preview.item.name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();}
 async function remove(item:ProcessAttachment){if(!confirm('Excluir definitivamente o anexo "'+item.name+'"?'))return;setBusy(true);try{if(preview?.item.key===item.key)close();await deleteProcessAttachment(processId,item.key);await refresh();setMessage("Anexo excluído.");}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold text-[#10234d]"><Paperclip size={18}/>Anexos do processo</h3><p className="mt-1 text-xs text-slate-500">Documentos guardados no Supabase Storage privado, separados por processo. PDF, imagens, Word e Excel · até 10 MB cada.</p></div><button type="button" disabled={loading||busy} onClick={()=>void refresh()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><RefreshCw size={14}/>Atualizar</button></div>
  <label className={"inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#10234d] px-4 py-2.5 text-sm font-semibold text-white "+(busy?"pointer-events-none opacity-50":"")}><Upload size={16}/>Adicionar anexos<input className="sr-only" type="file" multiple disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" onChange={e=>{void upload(e.target.files);e.target.value="";}}/></label>
  {message&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{message}</p>}
  {loading?<p className="text-sm text-slate-500">Carregando anexos...</p>:!files.length?<p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">Nenhum anexo enviado para este processo.</p>:<div className="divide-y divide-slate-100 rounded-lg border border-slate-200">{files.map(f=><div key={f.key} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-2"><FileText size={18} className="shrink-0 text-[#9b7951]"/><div className="min-w-0"><p className="break-all text-sm font-semibold">{f.name}</p><p className="text-xs text-slate-500">{(f.size/1024/1024).toFixed(2)} MB · {f.created_at?new Date(f.created_at).toLocaleString("pt-BR"):"Arquivo armazenado"}</p></div></div><div className="flex gap-2"><button type="button" disabled={busy||previewBusy} onClick={()=>void view(f)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Eye size={14}/>Visualizar</button><button type="button" disabled={busy} onClick={()=>void remove(f)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><Trash2 size={14}/>Excluir</button></div></div>)}</div>}
  {(preview||previewBusy)&&createPortal(<div className="fixed inset-0 z-[9999] flex justify-end bg-slate-950/55" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
   <aside role="dialog" aria-modal="true" aria-label="Visualizador de anexo" className={"flex h-full flex-col bg-white shadow-2xl transition-[width] duration-200 "+(expanded?"w-full":"w-full sm:w-[min(850px,85vw)]")}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-[#9b7951]">MW Despachante · Visualizar documento</p><h3 className="truncate text-sm font-bold text-[#10234d]" title={preview?.item.name}>{preview?.item.name||"Carregando documento..."}</h3></div><div className="flex items-center gap-1.5">{preview&&<><button type="button" onClick={download} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Download size={15}/>Baixar</button><button type="button" onClick={()=>setExpanded(x=>!x)} title={expanded?"Reduzir":"Ampliar"} className="rounded-lg border p-2">{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button></>}<button type="button" onClick={close} aria-label="Fechar visualizador" className="rounded-lg border p-2"><X size={18}/></button></div></header>
    <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">{previewBusy?<div className="grid h-full place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle size={20} className="animate-spin"/>Carregando documento...</span></div>:preview?.kind==="pdf"?<iframe title={preview.item.name} src={preview.url+"#toolbar=1&navpanes=0"} className="h-full min-h-[400px] w-full rounded-lg bg-white shadow-sm"/>:preview?.kind==="image"?<div className="flex min-h-full items-center justify-center"><img src={preview.url} alt={preview.item.name} className="max-h-full max-w-full object-contain"/></div>:<div className="mx-auto mt-16 max-w-md rounded-xl border bg-white p-6 text-center"><FileText size={35} className="mx-auto mb-3 text-slate-500"/><p className="font-semibold">Pré-visualização não disponível para este formato</p><p className="mt-2 text-sm text-slate-500">Arquivos Word e Excel podem ser baixados pelo botão acima. PDFs e imagens aparecem diretamente no visualizador.</p></div>}</div>
   </aside></div>,document.body)}
 </section>;
}
