import { useEffect, useState } from "react";
import { FileText, UploadCloud, RefreshCw, ExternalLink, FolderOpen } from "lucide-react";
import { account } from "../lib/appwrite";
type DriveFile = { id:string; name:string; mimeType:string; createdTime?:string; webViewLink?:string };
const FOLDER = "https://drive.google.com/drive/folders/1WU5KkOOdq4v1OnNaO8gJEWsI5Emi-yna";
async function request(method:"GET"|"POST", body?:unknown) {
  const jwt = await account.createJWT();
  const res=await fetch("/api/financial-documents",{method,headers:{"Authorization":"Bearer "+jwt.jwt,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "Não foi possível acessar o Google Drive.");
  return data;
}
export default function FinancialDocuments() {
  const [files,setFiles]=useState<DriveFile[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const load=async()=>{setBusy(true);setError("");try{const data=await request("GET");setFiles(data.files || []);}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const upload=async()=>{if(!file)return;setBusy(true);setError("");setNotice("");try{
    if(!["application/pdf","image/png","image/jpeg"].includes(file.type)) throw new Error("Selecione PDF, PNG ou JPG.");
    if(file.size>8*1024*1024) throw new Error("O arquivo deve ter no máximo 8 MB.");
    const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1] || "");reader.onerror=()=>reject(new Error("Erro ao ler arquivo."));reader.readAsDataURL(file);});
    await request("POST",{name:file.name,mimeType:file.type,data:encoded});
    setFile(null);setNotice("Nota fiscal salva no Google Drive.");const data=await request("GET");setFiles(data.files || []);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}};
  return <div className="space-y-5 pb-8">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">MW TECH — Financeiro</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Notas fiscais e documentos</h1><p className="mt-1 text-sm text-slate-600">Arquivo privado da empresa, separado dos documentos das prefeituras.</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold text-slate-800"><FolderOpen className="text-blue-700"/> MW TECH - Financeiro</div><a href={FOLDER} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">Abrir pasta no Drive <ExternalLink size={15}/></a></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><label className="flex-1 min-w-[240px]"><span className="mb-1 block text-xs font-semibold text-slate-600">Selecionar nota fiscal (PDF, JPG ou PNG — até 8 MB)</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e=>setFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"/></label><button disabled={!file||busy} onClick={()=>void upload()} className="inline-flex h-11 items-center gap-2 self-end rounded-lg bg-[#0b2b66] px-5 text-sm font-semibold text-white hover:bg-[#184b91] disabled:opacity-50"><UploadCloud size={17}/>{busy?"Aguarde...":"Salvar no Drive"}</button></div>
      {error&&<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Documentos arquivados</h2><button onClick={()=>void load()} disabled={busy} className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 disabled:opacity-50"><RefreshCw size={15}/>Atualizar</button></div>
      {files.length? <div className="divide-y divide-slate-100">{files.map(f=><div key={f.id} className="flex items-center gap-3 px-5 py-3"><FileText size={19} className="shrink-0 text-slate-500"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{f.name}</p><p className="text-xs text-slate-500">{f.createdTime?new Date(f.createdTime).toLocaleDateString("pt-BR"):""}</p></div><a href={f.webViewLink || "https://drive.google.com/file/d/"+encodeURIComponent(f.id)+"/view"} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700">Visualizar</a></div>)}</div> : <div className="px-5 py-10 text-center text-sm text-slate-500">{busy?"Carregando notas fiscais...":"Nenhum documento disponível nesta pasta."}</div>}
    </section>
  </div>;
}
