import { useState } from "react";
import { FolderOpen, Link2, ExternalLink, Save, Eye, EyeOff, Info, ShieldCheck, UploadCloud } from "lucide-react";
type Props={value?:string;onSave:(value:string)=>void};
const folderId=(url:string)=>{
 try{const u=new URL(url.trim());
  if(u.protocol!=="https:"||u.hostname!=="drive.google.com")return "";
  const match=u.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})\/?$/);
  return match?.[1]||"";
 }catch{return "";}
};
export default function ProcessDriveFolder({value,onSave}:Props){
 const [draft,setDraft]=useState(value||"");
 const [showEmbed,setShowEmbed]=useState(false);
 const [notice,setNotice]=useState("");
 const id=folderId(value||"");
 const draftId=folderId(draft);
 const resourceKey=(()=>{try{return new URL(value||"").searchParams.get("resourcekey")||"";}catch{return "";}})();
 const directUrl=value||"";
 const embedded=id?"https://drive.google.com/embeddedfolderview?id="+encodeURIComponent(id)+(resourceKey?"&resourcekey="+encodeURIComponent(resourceKey):"")+"#list":"";
 function save(){
  if(draft.trim()&&!draftId){setNotice("Use o link completo de uma pasta do Google Drive (drive.google.com/drive/folders/...).");return;}
  onSave(draft.trim());setNotice(draft.trim()?"Pasta vinculada ao processo.":"Vínculo com a pasta removido.");setShowEmbed(false);
 }
 return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><FolderOpen size={22}/></span><div><h3 className="text-base font-bold text-[#10234d]">Pasta do Google Drive</h3><p className="mt-1 text-sm text-slate-500">Vincule uma pasta individual a este processo, sem configurar a API do Google.</p></div></div>
  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-5 text-amber-900"><Info size={15} className="mr-1 inline align-text-bottom"/>Não é necessário tornar a pasta pública. Prefira acesso restrito, compartilhado apenas com as pessoas autorizadas. A prévia incorporada pode não funcionar para pastas restritas; nesses casos, use <b>Abrir pasta no Drive</b>.</div>
  <label className="block text-sm font-semibold text-[#10234d]">Link da pasta deste processo<input type="url" autoComplete="off" value={draft} onChange={e=>{setDraft(e.target.value);setNotice("");}} placeholder="https://drive.google.com/drive/folders/..." className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-[#9b7951]"/></label>
  <div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={(draft.trim()=== (value||"").trim())||Boolean(draft.trim()&&!draftId)} className="inline-flex items-center gap-2 rounded-lg bg-[#10234d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Save size={16}/>Salvar vínculo</button>{id&&<><a target="_blank" rel="noopener noreferrer" href={directUrl} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800"><ExternalLink size={15}/>Abrir pasta no Drive</a><a target="_blank" rel="noopener noreferrer" href={directUrl} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"><UploadCloud size={15}/>Adicionar arquivos pelo Drive</a><button type="button" onClick={()=>setShowEmbed(x=>!x)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold">{showEmbed?<EyeOff size={15}/>:<Eye size={15}/>} {showEmbed?"Ocultar prévia":"Visualizar pasta aqui"}</button></>}</div>
  {notice&&<p role="status" className="text-xs font-semibold text-slate-700">{notice}</p>}
  {id?<div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck size={15}/>Pasta vinculada</p><p className="mt-2 break-all text-xs text-slate-500">Identificador: {id}</p><p className="mt-1 text-xs text-slate-500">Envios, exclusões e permissões são controlados no Google Drive pela conta Google que tiver acesso.</p></div>:<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center"><Link2 className="mx-auto mb-2 text-slate-400"/><p className="text-sm text-slate-500">Nenhuma pasta do Drive vinculada. Crie uma pasta no Drive, copie o link e salve acima.</p></div>}
  {id&&showEmbed&&<div className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2"><span className="text-xs font-semibold text-slate-700">Arquivos da pasta</span><a target="_blank" rel="noopener noreferrer" href={directUrl} className="text-xs font-semibold text-blue-700">Abrir no Drive</a></div><iframe title="Arquivos da pasta do Google Drive" src={embedded} className="h-[440px] w-full bg-white sm:h-[550px]" referrerPolicy="strict-origin-when-cross-origin"/></div>}
 </section>;
}
