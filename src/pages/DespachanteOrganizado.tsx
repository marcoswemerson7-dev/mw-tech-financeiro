import SyncConflictReview, { type SyncConflict } from "../components/despachante/SyncConflictReview";
import { reconcileSnapshots, sameSnapshot } from "../services/despachanteReconcile";
import Dashboard from "../components/despachante/Dashboard";
import KanbanProcessos from "../components/despachante/KanbanProcessos";
import Processos, { type Tracking } from "../components/despachante/Processos";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { downloadDespachante, uploadDespachante, cloudRevision, despachanteCloudSession } from "../services/despachanteCloud";
import { ClipboardCheck, Printer, Plus, Trash2, Users, FolderOpen, FileText, Pencil, X } from "lucide-react";

type Client = {id:string; name:string; phone:string};
type Model = {id:string; name:string; groups:{title:string; docs:string[]}[]};
type Job = Tracking & {id:string; clientId:string; title:string; modelId:string; sellers?:string[]; buyers?:string[]; docs:{name:string; group:string; checked:boolean; status?:"pendente"|"recebido"|"dispensado"; detail?:string}[]; notes:string; created:string};
type RegistryOption = {id:string;name:string};
type Store = {clients:Client[]; models:Model[]; jobs:Job[]; processes:Job[]; registryCatalog:RegistryOption[]};
type Tab = "dashboard"|"processos"|"kanban"|"atendimentos"|"clientes"|"modelos";
const KEY="mw-despachante-organizado-v2";
const defaultRegistries:RegistryOption[]=[{id:'cartorio-ribeiro-goncalves',name:'Cartório de Ribeiro Gonçalves – PI'},{id:'cartorio-baixa-grande-do-ribeiro',name:'Cartório de Baixa Grande do Ribeiro – PI'}];
const predefined:Model[]=[
{id:"rural",name:"Escritura Rural PF–PF",groups:[
{title:"Vendedores",docs:["RG e CPF, inclusive dos cônjuges","Certidão de nascimento ou casamento","Pacto antenupcial registrado, se houver","Comprovante de endereço","Informar profissão","Certidão de indisponibilidade"]},
{title:"Compradores",docs:["RG e CPF, inclusive dos cônjuges","Certidão de nascimento ou casamento","Pacto antenupcial registrado, se houver","Comprovante de endereço","Informar profissão","Certidão de indisponibilidade"]},
{title:"Imóvel rural",docs:["Título aquisitivo","ITBI e comprovante de pagamento","Certidão de inteiro teor atualizada","Certidão de ações reais e pessoais reipersecutórias","Certidão de ônus reais","CCIR","Certidão do ITR quitado","Informar valor da compra e forma de pagamento","Laudo de avaliação"]},
{title:"Desmembramento (quando aplicável)",docs:["Memorial descritivo","Planta do imóvel","ART quitada"]},
{title:"Georreferenciamento (quando aplicável)",docs:["Peças técnicas do georreferenciamento certificado, quando exigíveis"]}]},
{id:"inventario",name:"Escritura de Inventário",groups:[{title:"Documentação",docs:["Petição do advogado","Certidão de óbito atualizada","Certidão de casamento atualizada","RG e CPF do falecido","RG e CPF do cônjuge do falecido","RG e CPF dos filhos do falecido","Certidões de casamento dos filhos, se for o caso","RG e CPF dos cônjuges dos filhos","Certidão de inteiro teor dos imóveis do espólio","Extratos bancários e previdência, se houver","Qualificação, contato e OAB do advogado","Extrato do FGTS, se for o caso","Dívidas do falecido, se houver","Laudo de avaliação e ITCMD","ITBI e laudo, se houver cessão ou compra e venda","CCIR, para imóvel rural","Certidão do ITR","Informação sobre inexistência de testamento"]}]},
{id:"doacao",name:"Escritura de Doação de Imóvel Rural",groups:[
{title:"Doador e donatário",docs:["Requerimento com firma reconhecida","RG e CPF, inclusive dos cônjuges","Certidão de nascimento ou casamento","Pacto antenupcial, se houver","Comprovante de endereço","Informar profissão","Certidão de indisponibilidade"]},
{title:"Pessoa jurídica (se aplicável)",docs:["Cartão CNPJ","Contrato ou estatuto social e alterações","Certidão simplificada da Junta Comercial","Documentos do representante","Certidão negativa de débitos trabalhistas","Certidão de débitos tributários federais","Certidão de indisponibilidade"]},
{title:"Imóvel rural",docs:["ITCMD","Certidão de inteiro teor","Certidão de ações reais e pessoais reipersecutórias","Certidão de ônus reais","CCIR","Laudo de avaliação"]},
{title:"Desmembramento (se aplicável)",docs:["Memorial descritivo","Anuência dos confrontantes","Planta do imóvel","ART quitada"]}]},
{id:"estremacao",name:"Escritura de Estremação",groups:[
{title:"Proprietários",docs:["RG e CPF, inclusive dos cônjuges","Certidão de nascimento ou casamento","Pacto antenupcial, se houver","Comprovante de endereço"]},
{title:"Confrontantes",docs:["RG e CPF, inclusive dos cônjuges","Certidão de nascimento ou casamento","Pacto antenupcial, se houver","Comprovante de endereço"]},
{title:"Imóvel rural",docs:["Título aquisitivo","Certidão de inteiro teor atualizada","Certidão de ações reais e pessoais reipersecutórias","Certidão de ônus reais","CCIR","Certidão do ITR quitado","CAR","Memorial descritivo assinado","Mapa da área assinado","ART","Declaração individual de respeito de limites","Laudo de avaliação"]}]},
{id:"retificacao",name:"Retificação de Área Rural",groups:[
{title:"1. Requerimento e qualificação",docs:[
"Requerimento dirigido à serventia, assinado por todos os proprietários, com firmas reconhecidas",
"Qualificação completa dos requerentes: nomes sem abreviações, RG/CPF ou CNPJ, nacionalidade, estado civil, união estável, filiação, profissão, endereço e e-mail",
"Representação: instrumento original ou cópia autenticada que comprove os poderes, quando houver",
"Procuração pública com poderes específicos para retificação/apuração de remanescente, quando aplicável",
"Justificativa do pedido e declaração de inexistência de alteração de divisas e respeito aos direitos dos confrontantes",
"Fundamentação do pedido nos arts. 212 e 213 da Lei 6.015/1973",
"Valor atribuído ao imóvel",
"Assinaturas de todos os proprietários e respectivos cônjuges, quando casados, com firmas reconhecidas"]},
{title:"2. Certidões e situação registral",docs:[
"Certidão de matrícula atualizada do imóvel (30 dias, conforme checklist de referência)",
"Cadeia dominial até a disposição do Poder Público ao particular, quando originário/derivado de outra circunscrição"]},
{title:"3. Planta da situação atual",docs:[
"Planta elaborada por responsável técnico, com identificação/localização e caracterização dos imóveis confrontantes",
"Planta com dimensões, endereço, informações fiscais, titulares e matrículas/transcrições dos confrontantes",
"Assinatura dos proprietários, confrontantes e responsável técnico na planta",
"Todos os vértices e dados do perímetro representados em escala legível",
"Indicação de área registrada, área atual, diferença apurada e percentual da diferença",
"Apresentação da planta em duas vias, conforme checklist da serventia"]},
{title:"4. Memorial descritivo e laudo",docs:[
"Memorial descritivo da área, elaborado e assinado pelo responsável técnico",
"Memorial SIGEF assinado digitalmente pelo técnico, quando o imóvel for certificado pelo INCRA",
"Laudo técnico autoexplicativo com informações suficientes, quando necessário"]},
{title:"5. Confrontantes e reconhecimento de limites",docs:[
"Declaração de reconhecimento de limites ou anuência individual dos confrontantes, vinculada à planta e ao memorial",
"Declarações com identificação e perímetro da confrontação, assinaturas e reconhecimento de firmas exigidos",
"Assinaturas de ambos os cônjuges dos confrontantes casados, conforme orientação do checklist",
"Declaração com várias páginas: frente e verso ou rubricas nas folhas e reconhecimento na página do perímetro",
"Anuência de órgãos competentes em confrontações com rodovias, ferrovias e ruas, quando aplicável",
"Verificação de assinaturas sem formato híbrido (físico e digital), conforme orientação do PDF",
"Confrontação com rio não navegável ou serra: reconhecimento pelos proprietários do outro lado, quando aplicável",
"Confrontante possuidor: anuência do posseiro e cônjuge, tempo de posse, cadeia de aquisição e prova da posse",
"Se o titular tabular do imóvel confrontante for identificável: obter também sua anuência, quando aplicável",
"Confrontante pessoa jurídica: documentação de representação e poderes para reconhecer limites",
"Pessoa jurídica: contrato social/consolidação e última alteração autenticados, quando aplicável",
"Pessoa jurídica: cartão CNPJ, certidão simplificada da Junta Comercial e RG/CPF dos representantes, quando aplicável",
"Representantes/procuradores dos confrontantes: instrumentos de poderes específicos, quando aplicável",
"Imóvel confrontante em outra comarca: matrícula atualizada e certidão de filiação até a origem, quando aplicável",
"Confrontante falecido: assinatura pelo inventariante ou legitimados indicados no checklist, conforme o caso"]},
{title:"6. Responsabilidade técnica",docs:[
"Documento de Responsabilidade Técnica (RT/ART pertinente) quitado",
"RT devidamente assinada por responsável técnico e contratante, com serviço e área levantada corretamente especificados"]},
{title:"7. Cadastro e tributos rurais",docs:[
"CCIR vigente, quitado, em nome do proprietário e com dados atualizados",
"DIAT / documento vigente de informação e apuração do ITR, com valor e dados atualizados",
"Certidão negativa de débitos federais e dívida ativa relativa ao imóvel rural",
"Alternativamente à certidão: comprovantes de ITR dos cinco últimos exercícios e DARFs quitados, conforme checklist"]},
{title:"8. Documentos eletrônicos e observações",docs:[
"Materialização de documentos eletrônicos ou assinados digitalmente, conforme orientação do checklist da serventia"]}
]},
{id:"usucapiao",name:"Ata Notarial de Usucapião Extrajudicial",groups:[
{title:"Requerentes",docs:["Requerimento de ata notarial e diligência","RG e CPF, inclusive dos cônjuges","Certidão de nascimento ou casamento atualizada","Pacto antenupcial, se houver","Comprovante de endereço completo","Informar profissão","E-mail e telefone"]},
{title:"Comprovação da posse",docs:["Justo título ou documentos de origem, continuidade, natureza e tempo da posse"]},
{title:"Imóvel",docs:["Certidão de inteiro teor ou informação sobre ausência de matrícula","Certidões de ônus e ações, se matriculado","Certidão negativa de registro, se não matriculado","Matrículas dos imóveis confinantes","IPTU ou cadastro rural, ITR e CCIR","Valor venal ou laudo de avaliação","Mapa e memorial descritivo / peças geodésicas"]},
{title:"Outros documentos",docs:["Procuração do advogado","Cópia da OAB do advogado"]}]}];
const id=()=>crypto.randomUUID();
function legacyStore():Store {
 const result:Store={clients:[],models:[],jobs:[],processes:[],registryCatalog:defaultRegistries};
 try {
  const old=JSON.parse(localStorage.getItem("mw-despachante-local-v1")||"null");
  if(!old)return result;
  if(Array.isArray(old.templates))result.models=old.templates.map((t:{id:string;name:string;docs:string[]})=>({id:t.id,name:t.name,groups:[{title:"Documentos",docs:t.docs}]}));
  if(Array.isArray(old.records))old.records.forEach((r:{id:string;client:string;phone:string;title:string;templateId:string;docs:Job["docs"];notes:string;created:string})=>{
   if(!r.id)return;
   const clientId="legacy-client-"+r.id;
   result.clients.push({id:clientId,name:r.client,phone:r.phone||""});
   result.jobs.push({id:r.id,clientId,title:r.title,modelId:r.templateId,docs:(r.docs||[]).map(d=>({...d,group:d.group||"Documentos"})),notes:r.notes||"",created:r.created});
  });
 }catch { /* Preserve current data if the legacy backup is unreadable. */ }
 return result;
}
function normalizeStore(value:Omit<Store,"processes"|"registryCatalog"> & {processes?:Job[];registryCatalog?:RegistryOption[]}):Store {
 const catalog=[...defaultRegistries,...(Array.isArray(value.registryCatalog)?value.registryCatalog:[]).filter(x=>x&&typeof x.name==="string"&&!defaultRegistries.some(d=>d.id===x.id))];
 if(Array.isArray(value.processes))return {...value,processes:value.processes,registryCatalog:catalog};
 const jobs:Job[]=[],processes:Job[]=[];
 for(const job of value.jobs){
  const hasChecklist=Boolean(job.modelId||job.docs?.length||job.sellers?.length||job.buyers?.length);
  const hasProcess=Boolean(job.status||job.protocol||job.registry||job.property||job.deadline||job.nextAction||job.location||job.history?.length||job.checklistJobId||!hasChecklist);
  if(hasChecklist)jobs.push(job);
  if(hasProcess)processes.push({...job,id:hasChecklist?"process-"+job.id:job.id,checklistJobId:job.checklistJobId||(hasChecklist?job.id:undefined),modelId:"",docs:[],sellers:[],buyers:[]});
 }
 return {...value,jobs,processes,registryCatalog:catalog};
}
function mergeMissing(current:Store,incoming:Store):Store {
 current=normalizeStore(current);incoming=normalizeStore(incoming);
 const add=<T extends {id:string}>(a:T[],b:T[])=>{const ids=new Set(a.map(x=>x.id));return [...a,...b.filter(x=>{if(ids.has(x.id))return false;ids.add(x.id);return true;})];};
 // Import clients only when their job is absent, avoiding duplicate legacy clients.
 const existingJobs=new Set(current.jobs.map(j=>j.id));
 const neededClients=new Set(incoming.jobs.filter(j=>!existingJobs.has(j.id)).map(j=>j.clientId));
 const legacyIds=new Set(incoming.clients.filter(c=>c.id.startsWith("legacy-client-")).map(c=>c.id));
 const incomingJobs=new Map(incoming.jobs.map(j=>[j.id,j]));
 const jobs=current.jobs.map(job=>{
  const source=incomingJobs.get(job.id);if(!source)return job;
  // Recover missing checklist content without replacing process fields or checked items.
  return {...job,
   docs:job.docs?.length?job.docs:source.docs||[],
   sellers:job.sellers?.length?job.sellers:source.sellers||job.sellers,
   buyers:job.buyers?.length?job.buyers:source.buyers||job.buyers,
   notes:job.notes||source.notes||"",
   modelId:job.modelId||source.modelId,
  };
 });
 return {clients:add(current.clients,incoming.clients.filter(c=>!legacyIds.has(c.id)||neededClients.has(c.id))),models:add(current.models,incoming.models),jobs:add(jobs,incoming.jobs),processes:add(current.processes,incoming.processes),registryCatalog:add(current.registryCatalog,incoming.registryCatalog)};
}
function load():Store {
 try {
  const value=JSON.parse(localStorage.getItem(KEY)||"null");
  if(value&&Array.isArray(value.clients)&&Array.isArray(value.models)&&Array.isArray(value.jobs)){
   const builtins=new Set(predefined.map(m=>m.id));
   if(!Array.isArray(value.processes)){try{if(!localStorage.getItem(KEY+"-antes-separacao"))localStorage.setItem(KEY+"-antes-separacao",JSON.stringify(value));}catch{/* Never discard readable current records if backup storage is full. */}}
   return normalizeStore({...value,models:[...predefined,...value.models.filter((m:Model)=>!builtins.has(m.id))]});
  }
 }catch { /* Legacy remains available for recovery. */ }
 return mergeMissing({clients:[],models:predefined,jobs:[],processes:[],registryCatalog:defaultRegistries},legacyStore());
}

const input="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-[#9b7951]";
const panel="rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
export default function DespachanteOrganizado(){
const [syncBusy,setSyncBusy]=useState(false),[syncInfo,setSyncInfo]=useState(""),[data,setData]=useState<Store>(load),[sellerDraft,setSellerDraft]=useState(""),[buyerDraft,setBuyerDraft]=useState(""),[sellers,setSellers]=useState<string[]>([]),[buyers,setBuyers]=useState<string[]>([]),[tab,setTab]=useState<Tab>("dashboard"),[selected,setSelected]=useState(""),[search,setSearch]=useState(""),[clientName,setClientName]=useState(""),[phone,setPhone]=useState(""),[jobClient,setJobClient]=useState(""),[jobModel,setJobModel]=useState("rural"),[jobTitle,setJobTitle]=useState(""),[modelName,setModelName]=useState(""),[modelDocs,setModelDocs]=useState(""),[error,setError]=useState("");
const [autoSync,setAutoSync]=useState(()=>localStorage.getItem("mw-despachante-sync-mode-v2")!=="off");
const [cloudOwner,setCloudOwner]=useState<string|null>(null);
useEffect(()=>{
 let alive=true;
 void despachanteCloudSession().then(session=>{
   if(alive)setCloudOwner(session.user.id);
 }).catch(error=>{
   if(alive)setSyncStatus("Salvo neste aparelho · "+(error instanceof Error?error.message:String(error)));
 });
 return()=>{alive=false;};
},[]);
const [syncStatus,setSyncStatus]=useState("Conectando à nuvem...");
const [initialLoaded,setInitialLoaded]=useState(false);
const [syncRequest,setSyncRequest]=useState(0);
const dataRef=useRef(data);
const busyAuto=useRef(false);
const syncRunner=useRef<(()=>Promise<void>)|null>(null);
const [savedBase]=useState<Store|null>(()=>{try{const raw=localStorage.getItem(KEY+"-sync-base-supabase-v1");return raw?normalizeStore(JSON.parse(raw)):null;}catch{return null;}});
const baseline=useRef<Store|null>(savedBase);
const [syncConflict,setSyncConflict]=useState<SyncConflict|null>(null);
const conflictRef=useRef<SyncConflict|null>(null);
useEffect(()=>{
 dataRef.current=data;
 try{localStorage.setItem(KEY,JSON.stringify(data));setError("");}catch{setError("Não foi possível salvar os dados neste navegador.");}
},[data]);
useEffect(()=>{
 localStorage.setItem("mw-despachante-sync-mode-v2",autoSync?"on":"off");
 if(!autoSync){setSyncBusy(false);setInitialLoaded(true);setSyncStatus("Salvo neste aparelho · sincronização pausada");return;}
 if(!cloudOwner){setSyncBusy(false);setInitialLoaded(true);setSyncStatus("Salvo neste aparelho · aguardando sessão para sincronizar");return;}
 let alive=true;
 const canonical=(value:Store):Store=>{
  const normalized=normalizeStore(value),builtins=new Set(predefined.map(m=>m.id));
  return {...normalized,models:[...predefined,...normalized.models.filter(m=>!builtins.has(m.id))]};
 };
 const sync=async()=>{
  if(!alive||busyAuto.current||conflictRef.current)return;
  busyAuto.current=true;setSyncBusy(true);setSyncStatus("Sincronizando processos e checklists...");
  try{
   let remote:Store|null=null,revision="";
   for(let attempt=0;attempt<3;attempt++){
    const before=await cloudRevision();
    remote=await downloadDespachante() as Store|null;
    const after=await cloudRevision();
    if(before===after){revision=after;break;}
    if(attempt===2)throw Error("A nuvem está recebendo alterações. Uma nova tentativa será feita automaticamente.");
   }
   if(!alive)return;
   const local=canonical(dataRef.current);
   const empty:Store={clients:[],models:predefined,jobs:[],processes:[],registryCatalog:defaultRegistries};
   const cloud=canonical(remote||empty);
   const result=reconcileSnapshots(baseline.current?canonical(baseline.current):null,local,cloud);
   if(result.conflicts.length){
    const conflict={base:baseline.current,local,remote:cloud,conflicts:result.conflicts};
    conflictRef.current=conflict;setSyncConflict(conflict);
    const conflictIds=[...new Set(result.conflicts.map(path=>path.split('.')[1]))];
    const names=conflictIds.map(id=>[...local.processes,...local.jobs,...local.clients].find(x=>x.id===id)).map(x=>x&&('title' in x?x.title:x.name)).filter(Boolean);
    setSyncStatus("Conflito de edição: "+(names.join(", ")||"há alterações diferentes nos dois aparelhos")+". As duas versões foram preservadas. Abra Sincronização para revisar.");
    setSyncInfo("Nenhum dado foi substituído. Há campos editados de formas diferentes nos dois aparelhos. Antes de escolher uma versão, mantenha os dados nos dois dispositivos.");
    return;
   }
   const merged=result.data as Store;
   if(!sameSnapshot(merged,cloud)){
    // Keep both pre-sync copies locally before publishing a merged snapshot.
    localStorage.setItem(KEY+"-antes-sincronizacao",JSON.stringify({local,remote}));
    await uploadDespachante(merged,revision);
   }
   if(!alive)return;
   baseline.current=merged;
   localStorage.setItem("mw-despachante-linked-owner",cloudOwner);
   localStorage.setItem(KEY+"-sync-base-supabase-v1",JSON.stringify(merged));
   setData(current=>{
    // Preserve edits typed while the network request was running.
    const latest=reconcileSnapshots(local,canonical(current),merged);
    return latest.conflicts.length||sameSnapshot(current,latest.data)?current:latest.data as Store;
   });
   setSyncStatus("Sincronizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+" · processos e checklists");
   setSyncInfo("");
  }catch(e){if(alive)setSyncStatus("Salvo neste aparelho · "+(e instanceof Error?e.message:String(e))+" · nova tentativa automática");}
  finally{busyAuto.current=false;if(alive){setSyncBusy(false);setInitialLoaded(true);}}
 };
 syncRunner.current=sync;
 void sync();
 const timer=window.setInterval(()=>void sync(),7000);
 const resume=()=>{if(document.visibilityState==="visible")void sync();};
 window.addEventListener("online",resume);window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);
 return()=>{alive=false;if(syncRunner.current===sync)syncRunner.current=null;window.clearInterval(timer);window.removeEventListener("online",resume);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);};
},[autoSync,cloudOwner]);
useEffect(()=>{if(autoSync&&cloudOwner)void syncRunner.current?.();},[syncRequest,autoSync,cloudOwner]);
useEffect(()=>{
 if(!autoSync||!initialLoaded)return;
 const timer=window.setTimeout(()=>setSyncRequest(n=>n+1),1400);
 return()=>window.clearTimeout(timer);
},[data,autoSync,initialLoaded]);
function resolveSyncConflict(choices:Record<string,"local"|"remote">){
 const conflict=conflictRef.current;if(!conflict)return;
 // Reapply the reviewed merge to the latest local edits before attempting another upload.
 const result=reconcileSnapshots(conflict.base, dataRef.current, conflict.remote, choices);
 if(result.conflicts.length){setSyncInfo("Surgiram novas alterações. Revise novamente antes de sincronizar.");conflictRef.current=null;setSyncConflict(null);setSyncRequest(n=>n+1);return;}
 localStorage.setItem(KEY+"-antes-resolver-conflito",JSON.stringify(conflict));
 baseline.current=conflict.remote as Store;
 localStorage.setItem(KEY+"-sync-base-supabase-v1",JSON.stringify(conflict.remote));
 dataRef.current=result.data as Store;setData(result.data as Store);
 conflictRef.current=null;setSyncConflict(null);setSyncRequest(n=>n+1);
}
async function enableAutoSync(){setAutoSync(true);setSyncRequest(n=>n+1);}

const current=data.jobs.find(j=>j.id===selected);const currentClient=data.clients.find(c=>c.id===current?.clientId);
const jobs=useMemo(()=>data.jobs.filter(j=>{const c=data.clients.find(c=>c.id===j.clientId);return (c?.name+" "+j.title).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));}),[data,search]);
const changeJob=(jobId:string,fn:(j:Job)=>Job)=>setData(d=>({...d,jobs:d.jobs.map(j=>j.id===jobId?{...fn(j),updatedAt:new Date().toISOString()}:j)}));
const changeProcess=(processId:string,fn:(j:Job)=>Job)=>setData(d=>({...d,processes:d.processes.map(j=>{
 if(j.id!==processId)return j;
 const next=fn(j),checklist=d.jobs.find(c=>c.id===next.checklistJobId);
 if(checklist&&checklist.clientId!==next.clientId)return {...next,checklistJobId:undefined,history:[{id:id(),at:new Date().toISOString(),title:"Checklist desvinculado",text:"O cliente do processo foi alterado. O checklist original foi preservado."},...(next.history||[])]};
 return next;
})}));
function linkChecklist(processId:string,checklistId:string){
 const process=data.processes.find(j=>j.id===processId),checklist=data.jobs.find(j=>j.id===checklistId);
 if(!process||checklistId&&!checklist)return;
 if(checklist&&checklist.clientId!==process.clientId&&!confirm("O checklist pertence a "+(data.clients.find(c=>c.id===checklist.clientId)?.name||"outro cliente")+". Alterar o cliente deste processo para vincular?"))return;
 const at=new Date().toISOString();changeProcess(processId,j=>({...j,checklistJobId:checklistId||undefined,clientId:checklist?.clientId||j.clientId,updatedAt:at,history:[{id:id(),at,title:"Vínculo do checklist atualizado",text:checklist?"Checklist vinculado: "+checklist.title:"Checklist desvinculado. O cadastro original foi preservado."},...(j.history||[])]}));
}
function removeProcess(job:Job){if(confirm("Excluir somente este processo e seu histórico? O checklist e o cliente serão mantidos.")){setData(d=>({...d,processes:d.processes.filter(p=>p.id!==job.id)}));setSelected("");}}
async function recoverMissing(){
 setSyncBusy(true);setSyncInfo("Buscando cadastros antigos e cópia da nuvem...");
 let remote:Store|null=null;let cloudError="";
 try{remote=await downloadDespachante() as Store|null;}catch(e){cloudError="Não foi possível consultar a nuvem: "+(e instanceof Error?e.message:String(e));}
 try{
  // Back up before adding records; existing IDs always keep the current version.
  localStorage.setItem(KEY+"-antes-recuperacao",localStorage.getItem(KEY)||JSON.stringify(data));
  setData(current=>{let next=mergeMissing(current,legacyStore());if(remote)next=mergeMissing(next,remote);return next;});
  setSelected("");setSearch("");setJobClient("");
  setSyncInfo("Busca concluída. Cadastros ausentes foram adicionados; registros existentes foram preservados. "+cloudError);
 }catch(e){setSyncInfo("A recuperação não foi concluída: "+(e instanceof Error?e.message:String(e)));}
 finally{setSyncBusy(false);}
}
async function syncUpload(){if(!cloudOwner){setSyncStatus("Sessão não identificada; faça login novamente no MW TECH Control.");return;}setAutoSync(true);setSyncRequest(n=>n+1);}
async function syncDownload(){setAutoSync(true);setSyncRequest(n=>n+1);}
function addClient(e:React.FormEvent){e.preventDefault();if(!clientName.trim())return;const c={id:id(),name:clientName.trim(),phone:phone.trim()};setData(d=>({...d,clients:[...d.clients,c]}));setJobClient(c.id);setClientName("");setPhone("");}
function addJob(e:React.FormEvent){e.preventDefault();const m=data.models.find(m=>m.id===jobModel);if(!m||!jobClient||!jobTitle.trim())return;const j:Job={id:id(),clientId:jobClient,title:jobTitle.trim(),modelId:m.id,sellers:[...sellers],buyers:[...buyers],docs:m.groups.flatMap(g=>g.docs.map(name=>({name,group:g.title,checked:false}))),notes:"",created:new Date().toISOString()};setData(d=>({...d,jobs:[j,...d.jobs]}));setSelected(j.id);setJobTitle("");setSellers([]);setBuyers([]);setSellerDraft("");setBuyerDraft("");}
function addModel(e:React.FormEvent){e.preventDefault();const docs=modelDocs.split("\n").map(s=>s.trim()).filter(Boolean);if(!modelName.trim()||!docs.length)return;const m={id:id(),name:modelName.trim(),groups:[{title:"Documentação",docs}]};setData(d=>({...d,models:[...d.models,m]}));setModelName("");setModelDocs("");}
function completeExistingChecklist(job:Job){
 const model=data.models.find(m=>m.id===job.modelId);
 if(!model)return;
 const existing=new Set(job.docs.map(d=>d.group+"::"+d.name));
 const additions=model.groups.flatMap(g=>g.docs.filter(name=>!existing.has(g.title+"::"+name)).map(name=>({name,group:g.title,checked:false,status:"pendente" as const})));
 if(!additions.length){alert("O atendimento já possui todos os itens deste modelo atualizado.");return;}
 if(!confirm("Adicionar "+additions.length+" exigências do modelo revisado a este atendimento? Os documentos já marcados permanecerão inalterados."))return;
 changeJob(job.id,j=>({...j,docs:[...j.docs,...additions]}));
}
function removeClient(c:Client){if([...data.jobs,...data.processes].some(j=>j.clientId===c.id)){alert("Exclua primeiro os atendimentos vinculados a este cliente.");return;}if(confirm("Excluir cliente "+c.name+"?"))setData(d=>({...d,clients:d.clients.filter(x=>x.id!==c.id)}));}
function removeJob(j:Job){if(data.processes.some(p=>p.checklistJobId===j.id)){alert("Este checklist está vinculado a um processo. Desvincule-o no processo antes de excluir.");return;}if(confirm("Excluir somente este checklist? Os processos e o cliente serão mantidos.")){setData(d=>({...d,jobs:d.jobs.filter(x=>x.id!==j.id)}));if(selected===j.id)setSelected("");}}
function printJob(j:Job,cover=false){
 const clientName=data.clients.find(c=>c.id===j.clientId)?.name||"—";
 const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]||ch));
 const received=(d:Job["docs"][number])=>d.status==="recebido"||(d.checked&&d.status!=="dispensado");
 const exempt=(d:Job["docs"][number])=>d.status==="dispensado";
 const pending=j.docs.filter(d=>!received(d)&&!exempt(d)).length;
 const groups=Array.from(new Set(j.docs.map(d=>d.group)));
 const tables=groups.map(group=>'<section class="group"><h2>'+escapeHtml(group)+'</h2><table><thead><tr><th>Documento / Informação complementar</th><th>Situação</th></tr></thead><tbody>'+
 j.docs.filter(d=>d.group===group).map(d=>'<tr><td><span class="'+(exempt(d)?"strike":"")+'">'+escapeHtml(d.name)+'</span>'+(d.detail?'<span class="detail"> — '+escapeHtml(d.detail)+'</span>':'')+'</td><td class="'+(exempt(d)?"exempt":received(d)?"received":"pending")+'">'+(exempt(d)?"Dispensado":received(d)?"Recebido":"Pendente")+'</td></tr>').join("")+'</tbody></table></section>').join("");
 const brandMark='<svg viewBox="0 0 120 132" width="80" height="92" fill="none" stroke="#ecb391" stroke-width="6" stroke-linejoin="round"><path d="M60 6 L83 22 L83 55 L110 39 L110 118 L60 82 L10 118 L10 39 L37 55 L37 22 Z"/><path d="M60 6 V82 M37 22 V100 M83 22 V100 M10 39 L60 82 L110 39 M10 118 L60 82 L110 118"/></svg>';
 const css=`@page{size:A4 portrait;margin:41mm 14mm 29mm}*{box-sizing:border-box}html,body{padding:0;margin:0;background:white}body{font:10pt Arial,sans-serif;color:#152747;print-color-adjust:exact;-webkit-print-color-adjust:exact}.letterhead{position:fixed;top:-41mm;left:-14mm;right:-14mm;height:35mm;background:#112554;overflow:hidden;display:flex;align-items:center;padding-left:19mm}.letterhead:after{content:"";position:absolute;right:-10mm;bottom:-14mm;width:115mm;height:26mm;background:#806d4e;border-radius:75% 0 0 0;transform:rotate(-5deg)}.brand{z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:0}.brand svg{height:26mm;width:25mm}.brand span{font-size:5.7pt;letter-spacing:.5px}.watermark{position:fixed;top:21%;right:-18mm;width:95mm;height:175mm;z-index:-1;opacity:.20;pointer-events:none}.watermark svg{width:100%;height:100%}.footer{position:fixed;bottom:-29mm;left:-14mm;right:-14mm;height:24mm;display:flex;align-items:center;justify-content:space-around;gap:7mm;padding:3mm 11mm;background:#806d4e;color:white;font-size:8pt;line-height:1.5}.footer>div+div{border-left:1px solid rgba(255,255,255,.9);padding-left:5mm}.footer>div{flex:1}.title{text-align:center;margin:2mm 0 6mm}.title h1{font-size:15pt;margin:0 0 2mm}.title p{color:#806d4e;margin:0;font-size:9pt}.info{border:1px solid #dfe2e8;border-left:3px solid #806d4e;padding:3mm 4mm;line-height:1.45;background:rgba(255,255,255,.93)}.info p{margin:1mm 0;overflow-wrap:anywhere}.stats{display:flex;gap:2mm;margin:4mm 0 5mm}.stats span{flex:1;text-align:center;border:1px solid #e1e5e8;border-radius:2mm;background:#faf9f6;padding:2.5mm 1mm;font-size:9pt}.group{margin:4mm 0;break-inside:auto}.group h2{font-size:10pt;background:#f0ece5;color:#5a462e;padding:2mm 3mm;margin:0;break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid}th{text-align:left;color:#5b6578;font-size:8pt;padding:2mm;border-bottom:1px solid #ced4dd}th:last-child,td:last-child{width:26mm;text-align:center}td{padding:2.2mm;border-bottom:1px solid #e1e5eb;vertical-align:top;font-size:9pt;line-height:1.25;overflow-wrap:anywhere}.detail{color:#9b642b;font-weight:700}.strike{text-decoration:line-through;color:#9aa0a8}.received{color:#176744;font-weight:bold}.pending{color:#936a29}.exempt{color:#6b7280}.notes{margin-top:6mm;border-top:1px solid #d5d8df;padding-top:3mm;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}.sign{text-align:center;margin:10mm 0 3mm;line-height:1.8;break-inside:avoid}@media screen{body{max-width:800px;margin:0 auto;padding:30px 15px 110px}.letterhead{position:relative;top:auto;left:auto;right:auto;margin:-30px -15px 16px}.watermark{position:fixed}.footer{position:relative;bottom:auto;left:auto;right:auto;margin:30px -15px -110px}.content{position:relative}}@media print{.content{position:relative}.group h2{break-after:avoid}body{background:#fff}}@media print{
@page{size:A4 portrait;margin:12mm 13mm}
html,body{margin:0!important;padding:0!important;overflow:visible!important}
body{max-width:none!important;background:#fff!important}
.letterhead{position:relative!important;top:auto!important;left:auto!important;right:auto!important;height:32mm!important;margin:0 0 7mm!important;padding-left:13mm!important;break-after:avoid!important}
.letterhead:after{bottom:-13mm}
.brand svg{height:24mm;width:23mm}
.watermark{position:absolute!important;top:52mm!important;right:-7mm!important;width:95mm!important;height:145mm!important;opacity:.13!important;z-index:-1!important}
.content{position:relative!important}
.footer{position:relative!important;bottom:auto!important;left:auto!important;right:auto!important;height:auto!important;min-height:21mm!important;margin:8mm 0 0!important;padding:3mm 5mm!important;break-inside:avoid!important}
.group h2{break-after:avoid!important}
thead{display:table-header-group!important}
tr{break-inside:avoid!important}
}.party-boxes{display:flex;gap:3mm;margin:3mm 0}.party-boxes section{flex:1;border:1px solid #e0e4ea;padding:2.5mm 3mm;break-inside:avoid}.party-boxes b{font-size:8pt;color:#806d4e}.party-boxes p{font-size:8.3pt;margin:1mm 0;line-height:1.35}.progress-label{font-size:8.5pt;color:#806d4e;margin:3mm 0 1mm}.progress-track{height:2mm;background:#e8e7e2;border-radius:2mm;overflow:hidden;margin-bottom:4mm}.progress-value{height:100%;background:#806d4e}.disclaimer{font-size:8.5pt;color:#596579;margin-top:4mm;line-height:1.4;break-inside:avoid}.title h1{font-size:13.5pt}`;
 const exigible=j.docs.filter(d=>!exempt(d)).length;
 const percent=exigible?Math.round(j.docs.filter(received).length/exigible*100):100;
 const listPeople=(people:string[])=>people.length?people.map((name,i)=>'<p>'+String(i+1).padStart(2,"0")+' — '+escapeHtml(name)+'</p>').join(""):'<p>Não informado</p>';
 const checklistBody='<div class="letterhead"><div class="brand">'+brandMark+'<span>DESPACHANTE IMOBILIÁRIO</span></div></div><div class="watermark">'+brandMark+'</div><main class="content"><div class="title"><h1>RELATÓRIO DE CONFERÊNCIA DOCUMENTAL</h1><p>'+escapeHtml(j.title)+'</p></div><div class="info"><p><b>IDENTIFICAÇÃO DO ATENDIMENTO</b></p><p><b>Cliente:</b> '+escapeHtml(clientName)+'</p><p><b>Serviço:</b> '+escapeHtml(j.title)+'</p><p><b>Data:</b> '+new Date(j.created).toLocaleDateString("pt-BR")+'</p></div><div class="party-boxes"><section><b>VENDEDORES</b>'+listPeople(j.sellers||[])+'</section><section><b>COMPRADORES</b>'+listPeople(j.buyers||[])+'</section></div><div class="stats"><span><b>'+j.docs.length+'</b> cadastrados</span><span><b>'+exigible+'</b> exigíveis</span><span><b>'+j.docs.filter(received).length+'</b> recebidos</span><span><b>'+pending+'</b> pendentes</span><span><b>'+j.docs.filter(exempt).length+'</b> dispensados</span></div><div class="progress-label">Progresso dos documentos exigíveis: '+percent+'%</div><div class="progress-track"><div class="progress-value" style="width:'+percent+'%"></div></div>'+tables+'<div class="notes"><b>Observações:</b> '+escapeHtml(j.notes||"Nenhuma observação registrada.")+'</div><p class="disclaimer">A conferência documental é preliminar e poderá ser complementada conforme as exigências da serventia competente.</p><div class="sign">________________________________________<br>Responsável pelo atendimento</div></main><div class="footer"><div>(89) 9 9930-8209</div><div>despachantemarcoswemerson@gmail.com<br>marcoswemerson7@gmail.com</div><div>Ribeiro Gonçalves–PI<br>Baixa Grande do Ribeiro–PI</div></div>';
 const statusLabels:Record<string,string>={preparacao:"Em preparação",protocolado:"Protocolado",analise:"Em análise",devolutiva:"Nota devolutiva",cliente:"Aguardando cliente",finalizado:"Finalizado",cancelado:"Cancelado"};
 const field=(label:string,value:string)=>'<div class="cover-field"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value||"Não informado")+'</strong></div>';
 const history=[...(j.history||[]),{id:"created",at:j.created,title:"Atendimento cadastrado",text:j.title}].map(h=>'<section class="group"><h2>'+escapeHtml(new Date(h.at).toLocaleString("pt-BR"))+' · '+escapeHtml(h.title)+'</h2><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+escapeHtml(h.text)+'</p></section>').join("");
 const coverBody='<div class="letterhead"><div class="brand">'+brandMark+'<span>DESPACHANTE IMOBILIÁRIO</span></div></div><div class="watermark">'+brandMark+'</div><main class="content"><div class="title"><h1>FOLHA DE ROSTO DO PROCESSO</h1><p>Identificação, acompanhamento e histórico de movimentações</p></div><section class="group client-ident"><h2>IDENTIFICAÇÃO DO CLIENTE E DO SERVIÇO</h2><div class="info">'+field("Cliente",clientName)+field("Telefone",data.clients.find(c=>c.id===j.clientId)?.phone||"")+field("Serviço / assunto",j.title)+field("Entrada",new Date(j.created).toLocaleString("pt-BR"))+field("Última atualização",new Date(j.updatedAt||j.created).toLocaleString("pt-BR"))+'</div></section><section class="group"><h2>SITUAÇÃO E PROTOCOLO</h2><div class="info">'+field("Status",statusLabels[j.status||"preparacao"]||"Em preparação")+field("Local atual",j.location||"Escritório")+field("Cartório / órgão",j.registry||"")+field("Protocolo / solicitação",j.protocol||"")+field("Imóvel / matrícula",j.property||"")+field("Link de acompanhamento",j.link||"")+'</div></section><section class="group"><h2>PRÓXIMA PROVIDÊNCIA</h2><div class="info" style="white-space:pre-wrap">'+field("Providência",j.nextAction||"")+field("Prazo",j.deadline?j.deadline.split("-").reverse().join("/"):"")+'</div></section><div class="party-boxes"><section><b>VENDEDORES</b>'+listPeople(j.sellers||[])+'</section><section><b>COMPRADORES</b>'+listPeople(j.buyers||[])+'</section></div><div class="stats"><span><b>'+j.docs.filter(received).length+'</b> recebidos</span><span><b>'+pending+'</b> pendentes</span><span><b>'+j.docs.filter(exempt).length+'</b> dispensados</span></div><section class="group"><h2>DOCUMENTAÇÃO E INFORMAÇÕES COMPLEMENTARES</h2></section>'+tables+'<section class="notes"><b>Observações do atendimento</b><p>'+escapeHtml(j.notes||"Nenhuma observação registrada.")+'</p></section><section class="group"><h2>HISTÓRICO E COMENTÁRIOS</h2></section>'+history+'<p class="disclaimer">Emitido em '+escapeHtml(new Date().toLocaleString("pt-BR"))+'. As informações refletem os dados salvos no processo.</p></main><div class="footer"><div>(89) 9 9930-8209</div><div>despachantemarcoswemerson@gmail.com<br>marcoswemerson7@gmail.com</div><div>Ribeiro Gonçalves–PI<br>Baixa Grande do Ribeiro–PI</div></div>';
 const coverCss=`.cover-print .info{display:grid;grid-template-columns:1fr 1fr;border:1px solid #d7dde6;border-left:3px solid #806d4e;padding:0;background:#fff;white-space:normal!important}.cover-print .cover-field{min-width:0;padding:3mm 4mm;border-bottom:1px solid #e4e7ec;overflow-wrap:anywhere;white-space:pre-wrap}.cover-print .cover-field:nth-child(odd){border-right:1px solid #e4e7ec}.cover-print .cover-field span{display:block;font-size:7.5pt;font-weight:700;color:#7b6848;text-transform:uppercase;letter-spacing:.35px;margin-bottom:1.4mm}.cover-print .cover-field strong{display:block;font-size:9.5pt;font-weight:500;line-height:1.4;color:#182640}.cover-print .client-ident .cover-field:first-child strong{font-size:12pt;font-weight:700}.cover-print .client-ident .cover-field:nth-child(3){grid-column:1/-1;border-right:0;background:#faf9f6}.cover-print .group h2{font-size:9pt;letter-spacing:.25px}.cover-print .group{margin:4mm 0}.cover-print .notes{padding:3mm 4mm;border:1px solid #d7dde6;background:#fafbfc}.cover-print .title{margin-bottom:5mm}`;
 const body=cover?coverBody:checklistBody;
 const popup=window.open("","_blank");
 if(!popup){alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site.");return;}
 popup.document.open();
 popup.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>MW Despachante — Processo e documentação</title><style>'+css+(cover?coverCss:'')+'</style></head><body class="'+(cover?'cover-print':'')+'">'+body+'</body></html>');
 popup.document.close();
 popup.focus();
 popup.setTimeout(()=>popup.print(),500);
}
function addPerson(kind:"sellers"|"buyers",name:string,jobId?:string){
 const cleaned=name.trim();if(!cleaned)return;
 if(jobId){changeJob(jobId,j=>({...j,[kind]:[...(j[kind]||[]),cleaned]}));}
 else if(kind==="sellers"){setSellers(x=>[...x,cleaned]);setSellerDraft("");}
 else {setBuyers(x=>[...x,cleaned]);setBuyerDraft("");}
}
function peopleFields(kind:"sellers"|"buyers",names:string[],draft:string,setDraft:(s:string)=>void,jobId?:string){
 const label=kind==="sellers"?"Vendedores":"Compradores";
 return <div className="rounded-xl border border-slate-200 p-3"><h3 className="mb-2 text-sm font-bold text-[#10234d]">{label} ({names.length})</h3>
 <div className="flex gap-2"><input aria-label={"Nome de "+label.toLowerCase()} className={input+" !mt-0 flex-1"} placeholder={"Nome do "+(kind==="sellers"?"vendedor":"comprador")} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addPerson(kind,draft,jobId);setDraft("");}}}/><button type="button" className="rounded-lg bg-[#10234d] px-3 text-xs font-bold text-white" onClick={()=>{addPerson(kind,draft,jobId);setDraft("");}}>+ Adicionar</button></div>
 {names.length>0&&<div className="mt-2 space-y-1">{names.map((name,i)=><div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{i+1}. {name}</span><button type="button" aria-label={"Remover "+name} onClick={()=>jobId?changeJob(jobId,j=>({...j,[kind]:(j[kind]||[]).filter((_,n)=>n!==i)})):kind==="sellers"?setSellers(x=>x.filter((_,n)=>n!==i)):setBuyers(x=>x.filter((_,n)=>n!==i))} className="text-red-600"><Trash2 size={15}/></button></div>)}</div>}</div>;
}
return <div className="mx-auto max-w-7xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#967852]">MW TECH CONTROL</p><h1 className="text-2xl font-extrabold text-[#10234d]">MW Despachante</h1><p className="text-sm text-slate-500">Gestão de processos e documentação imobiliária</p></div><ClipboardCheck size={35} color="#967852"/></div>
{syncConflict&&<SyncConflictReview conflict={syncConflict} onResolve={resolveSyncConflict}/>}
<div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs"><span className="font-semibold text-slate-600">{syncStatus}</span><button type="button" disabled={syncBusy} onClick={syncUpload} className="font-semibold text-[#846640] disabled:opacity-50">{syncBusy?"Sincronizando…":"Sincronizar agora"}</button></div>
<details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-[#122452]">Sincronização e cadastros <span className="ml-2 text-xs font-normal text-slate-500">{syncBusy?"Em andamento…":autoSync?"Automática":"Manual"}</span></summary><div className="mt-4 space-y-3"><p className="text-xs font-semibold text-[#715735]">{syncStatus}</p><button type="button" disabled={syncBusy} onClick={()=>autoSync?(setAutoSync(false),setSyncStatus("Sincronização pausada")):void enableAutoSync()} className="rounded-lg border border-[#806d4e] px-3 py-2 text-xs font-bold">{autoSync?"Desativar sincronização automática":"Ativar sincronização automática"}</button><p className="text-xs text-slate-600">Processos, clientes e checklists são sincronizados automaticamente entre aparelhos conectados à mesma conta. Mantenha a página aberta até aparecer “Sincronizado”.</p><div className="flex gap-2 flex-wrap"><button type="button" disabled={syncBusy} onClick={recoverMissing} className="rounded-lg border border-emerald-700 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">Buscar clientes e checklists ausentes</button><button type="button" disabled={syncBusy} onClick={syncUpload} className="rounded-lg bg-[#122452] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Sincronizar agora</button><button type="button" disabled={syncBusy} onClick={syncDownload} className="rounded-lg border border-[#122452] px-3 py-2 text-xs font-bold text-[#122452] disabled:opacity-50">Buscar atualizações</button></div>{syncInfo&&<p role="status" className="text-xs text-[#745a35]">{syncInfo}</p>}<p className="text-xs text-amber-900">{autoSync?"Sincronização automática ativada.":"Sincronização manual. Para localizar cadastros antigos sem substituir os atuais, use Buscar clientes e checklists ausentes."}</p></div></details>{error&&<p role="alert" className="text-red-600">{error}</p>}
{!initialLoaded&&<p role="status" className="text-sm text-slate-500">Carregando os cadastros existentes…</p>}
<div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{([{k:"dashboard",label:"Visão geral",Icon:FolderOpen},{k:"processos",label:"Processos",Icon:FolderOpen},{k:"kanban",label:"Kanban",Icon:FolderOpen},{k:"atendimentos",label:"Checklists",Icon:ClipboardCheck},{k:"clientes",label:"Clientes",Icon:Users},{k:"modelos",label:"Modelos de checklist",Icon:FileText}] as const).map(x=><button key={x.k} onClick={()=>{setTab(x.k);setSelected("");setJobClient("");}} className={"flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold "+(tab===x.k?"bg-[#10234d] text-white":"border border-slate-200 bg-white text-slate-700")}><x.Icon size={16}/>{x.label}</button>)}</div>
{tab==="dashboard"&&<Dashboard processes={data.processes} checklists={data.jobs} clients={data.clients} navigate={section=>{setTab(section);setSelected("");setJobClient("");setSearch("");}} openProcess={processId=>{setSelected(processId);setJobClient("");setTab("processos");}} openChecklist={checklistId=>{setSelected(checklistId);setSearch("");setTab("atendimentos");}}/>}
{tab==="kanban"&&<KanbanProcessos processes={data.processes} clients={data.clients} openProcess={processId=>{setSelected(processId);setJobClient("");setTab("processos");}} goToProcesses={()=>{setSelected("");setJobClient("");setTab("processos");}} changeStatus={(processId,status)=>{const labels:Record<string,string>={preparacao:"Em preparação",protocolado:"Protocolado",analise:"Em análise",devolutiva:"Nota devolutiva",cliente:"Aguardando cliente",finalizado:"Finalizado",cancelado:"Cancelado"};changeProcess(processId,p=>{const previous=p.status||"preparacao";if(previous===status)return p;const at=new Date().toISOString();return {...p,status,updatedAt:at,history:[{id:id(),at,title:"Etapa atualizada pelo Kanban",text:(labels[previous]||previous)+" → "+(labels[status]||status)},...(p.history||[])]};});}}/>}
{tab==="processos"&&<Processos registryOptions={data.registryCatalog} onCreateRegistry={(name)=>{const existing=data.registryCatalog.find(item=>item.name.toLocaleLowerCase('pt-BR')===name.trim().toLocaleLowerCase('pt-BR'));if(existing)return existing.name;const newEntry={id:id(),name:name.trim()};setData(d=>({...d,registryCatalog:[...d.registryCatalog,newEntry]}));return newEntry.name;}} onCreateClient={(name,phone)=>{const clientId=id();setData(d=>({...d,clients:[...d.clients,{id:clientId,name,phone}]}));return clientId;}} linkChecklist={linkChecklist} remove={jobId=>{const job=data.processes.find(j=>j.id===jobId);if(job)removeProcess(job);}} key={selected+jobClient} initialId={selected} initialClient={jobClient?data.clients.find(c=>c.id===jobClient)?.name||"":""} printCover={jobId=>{const job=data.processes.find(j=>j.id===jobId);if(job){const checklist=data.jobs.find(j=>j.id===job.checklistJobId);printJob({...job,docs:checklist?.docs||job.docs,sellers:checklist?.sellers||job.sellers,buyers:checklist?.buyers||job.buyers,notes:checklist&&checklist.id!==job.id?[job.notes&&"Observações do processo: "+job.notes,checklist.notes&&"Observações do checklist: "+checklist.notes].filter(Boolean).join("\n\n"):job.notes,history:checklist&&checklist.id!==job.id?[...(job.history||[]),...(checklist.history||[])].filter((entry,index,list)=>list.findIndex(item=>item.id===entry.id)===index).sort((a,b)=>b.at.localeCompare(a.at)):job.history},true);}}} jobs={data.processes} checklists={data.jobs} clients={data.clients} update={(jobId,fn)=>changeProcess(jobId,j=>({...j,...fn(j)}))} create={(clientId,title)=>{const jobId=id();const at=new Date().toISOString();setData(d=>({...d,processes:[{id:jobId,clientId,title,modelId:"",docs:[],notes:"",created:at,status:"preparacao",location:"Escritório"},...d.processes]}));return jobId;}} openChecklist={jobId=>{const job=data.processes.find(j=>j.id===jobId);if(!job?.checklistJobId)return;setSearch("");setSelected(job.checklistJobId);setTab("atendimentos");}}/>}
{tab==="clientes"&&<div className="grid gap-5 lg:grid-cols-3"><form onSubmit={addClient} className={panel+" space-y-3"}><h2 className="font-bold">Novo cliente</h2><label className="block text-sm">Nome completo<input className={input} required value={clientName} onChange={e=>setClientName(e.target.value)}/></label><label className="block text-sm">Telefone<input className={input} value={phone} onChange={e=>setPhone(e.target.value)}/></label><button className="rounded-lg bg-[#10234d] px-4 py-2.5 text-sm font-bold text-white">Cadastrar cliente</button></form><section className={panel+" lg:col-span-2"}><h2 className="mb-3 font-bold">Clientes cadastrados</h2>{!data.clients.length?<p className="text-sm text-slate-500">Nenhum cliente cadastrado.</p>:<div className="space-y-2">{data.clients.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><span><b className="block text-sm">{c.name}</b><small className="text-slate-500">{c.phone||"Sem telefone"} · {data.jobs.filter(j=>j.clientId===c.id).length} checklist(s) · {data.processes.filter(j=>j.clientId===c.id).length} processo(s)</small></span><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={()=>{setJobClient(c.id);setSelected("");setTab("processos");}}>Ver processos</button><button title="Novo checklist" onClick={()=>{setJobClient(c.id);setTab("atendimentos");}} className="rounded-lg border px-3 py-2 text-xs"><Plus size={15}/></button><button title="Editar" onClick={()=>{const name=prompt("Nome do cliente",c.name);if(name===null||!name.trim())return;const tel=prompt("Telefone",c.phone);if(tel===null)return;setData(d=>({...d,clients:d.clients.map(x=>x.id===c.id?{...x,name:name.trim(),phone:tel}:x)}));}} className="rounded-lg border px-3 py-2"><Pencil size={15}/></button><button title="Excluir" onClick={()=>removeClient(c)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700"><Trash2 size={15}/></button></div></div>)}</div>}</section></div>}
{tab==="modelos"&&<div className="grid gap-5 lg:grid-cols-2"><form onSubmit={addModel} className={panel+" space-y-3"}><h2 className="font-bold">Criar modelo de checklist</h2><label className="block text-sm">Nome do modelo<input className={input} value={modelName} onChange={e=>setModelName(e.target.value)} required/></label><label className="block text-sm">Documentos (um por linha)<textarea className={input+" min-h-36"} value={modelDocs} onChange={e=>setModelDocs(e.target.value)} required/></label><button className="rounded-lg bg-[#10234d] px-4 py-2.5 text-sm font-bold text-white">Salvar modelo</button></form><section className={panel}><h2 className="mb-3 font-bold">Modelos disponíveis</h2><div className="space-y-2">{data.models.map(m=><div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border p-3"><div><b className="text-sm">{m.name}</b><p className="text-xs text-slate-500">{m.groups.reduce((sum,g)=>sum+g.docs.length,0)} itens</p></div>{!predefined.some(p=>p.id===m.id)&&<button title="Excluir modelo" onClick={()=>{if(data.jobs.some(j=>j.modelId===m.id)){alert("Este modelo está em uso.");return;}if(confirm("Excluir modelo?"))setData(d=>({...d,models:d.models.filter(x=>x.id!==m.id)}));}} className="text-red-600"><Trash2 size={16}/></button>}</div>)}</div></section></div>}
{tab==="atendimentos"&&<><div className="grid gap-5 lg:grid-cols-2"><form onSubmit={addJob} className={panel+" space-y-3"}><h2 className="font-bold">Novo checklist</h2><label className="block text-sm">Cliente<select className={input} required value={jobClient} onChange={e=>setJobClient(e.target.value)}><option value="">Selecione o cliente</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button type="button" className="text-xs font-semibold text-[#846640] underline" onClick={()=>setTab("clientes")}>+ Cadastrar novo cliente</button><label className="block text-sm">Serviço / assunto<input className={input} required value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="Ex.: Escritura do imóvel rural"/></label><label className="block text-sm">Modelo<select className={input} value={jobModel} onChange={e=>setJobModel(e.target.value)}>{data.models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{peopleFields("sellers",sellers,sellerDraft,setSellerDraft)}{peopleFields("buyers",buyers,buyerDraft,setBuyerDraft)}<button className="rounded-lg bg-[#10234d] px-4 py-2.5 text-sm font-bold text-white">Criar checklist do cliente</button></form><div className={panel}><h2 className="font-bold">Como funciona</h2><p className="mt-2 text-sm leading-7 text-slate-600">Cadastre o cliente apenas uma vez. Crie quantos atendimentos precisar e escolha o modelo de documentos. Abra o atendimento para marcar cada item e imprimir o relatório com os documentos recebidos e pendentes.</p></div></div>
<section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Checklists cadastrados</h2><input className={input+" !mt-0 max-w-xs"} placeholder="Buscar cliente ou serviço" value={search} onChange={e=>setSearch(e.target.value)}/></div>{!jobs.length?<p className="text-sm text-slate-500">Nenhum checklist cadastrado.</p>:<div className="space-y-2">{jobs.map(j=>{const done=j.docs.filter(d=>d.status==="recebido"||(d.checked&&d.status!=="dispensado")).length;const name=data.clients.find(c=>c.id===j.clientId)?.name||"Cliente não encontrado";return <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><button className="min-w-0 flex-1 text-left" onClick={()=>setSelected(j.id)}><b className="block text-sm">{name}</b><small className="text-slate-500">{j.title} · {done}/{j.docs.length} documentos ({j.docs.length?Math.round(done/j.docs.length*100):0}%)</small><div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#9b7951]" style={{width:(j.docs.length?done/j.docs.length*100:0)+"%"}}/></div></button><div className="flex gap-2"><button onClick={()=>setSelected(j.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Abrir</button><button onClick={()=>printJob(j)} title="Imprimir relatório" className="rounded-lg border px-3 py-2"><Printer size={17}/></button><button onClick={()=>removeJob(j)} title="Excluir atendimento" className="rounded-lg border border-red-200 px-3 py-2 text-red-700"><Trash2 size={17}/></button></div></div>})}</div>}</section>
{current&&<section className={panel+" space-y-4"}><div className="flex justify-between gap-3"><div><button type="button" className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800" onClick={()=>{const process=data.processes.find(j=>j.checklistJobId===current.id);setSelected(process?.id||"");setTab("processos");setJobClient(process?"":current.clientId);}}>Abrir processo / histórico</button><p className="text-xs text-[#9b7951]">Checklist do atendimento</p><h2 className="text-xl font-bold">{currentClient?.name}</h2><p className="text-sm text-slate-500">{current.title}</p></div><button aria-label="Fechar" onClick={()=>setSelected("")}><X size={20}/></button></div>
{!current.modelId&&<label className="block text-sm">Adicionar modelo de checklist<select className={input} value="" onChange={e=>{const model=data.models.find(m=>m.id===e.target.value);if(model)changeJob(current.id,j=>({...j,modelId:model.id,docs:model.groups.flatMap(g=>g.docs.map(name=>({name,group:g.title,checked:false})))}));}}><option value="">Selecione um modelo</option>{data.models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
<div className="grid gap-3 md:grid-cols-2">{peopleFields("sellers",current.sellers||[],sellerDraft,setSellerDraft,current.id)}{peopleFields("buyers",current.buyers||[],buyerDraft,setBuyerDraft,current.id)}</div>
{Array.from(new Set(current.docs.map(d=>d.group))).map(group=><div key={group}><h3 className="mb-2 rounded-lg bg-[#f1ede6] px-3 py-2 text-sm font-bold text-[#625035]">{group}</h3><div className="space-y-2">{current.docs.map((d,i)=>d.group!==group?null:<label key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"><label className="flex shrink-0 items-center gap-1.5 text-xs"><input type="checkbox" className="size-4 accent-emerald-700" checked={d.status==="recebido"||(d.checked&&d.status!=="dispensado")} onChange={e=>changeJob(current.id,j=>({...j,docs:j.docs.map((x,n)=>n===i?{...x,status:e.target.checked?"recebido":"pendente",checked:e.target.checked}:x)}))}/>Recebido</label><button type="button" className={"shrink-0 rounded-lg border px-2 py-2 text-xs "+(d.status==="dispensado"?"border-slate-400 bg-slate-200 text-slate-700":"border-slate-200 text-slate-500")} onClick={()=>changeJob(current.id,j=>({...j,docs:j.docs.map((x,n)=>n===i?{...x,status:d.status==="dispensado"?"pendente":"dispensado",checked:false}:x)}))}>{d.status==="dispensado"?"Reativar":"Dispensar"}</button><span className={"min-w-[170px] flex-1 font-medium "+(d.status==="dispensado"?"text-slate-400 line-through":"")}>{d.name}</span><input aria-label={"Informação complementar: "+d.name} className="w-full min-w-[170px] flex-[1.4] rounded-lg border border-[#e0c6a6] bg-amber-50/50 px-3 py-2 text-sm font-semibold text-[#98602b] placeholder:font-normal placeholder:text-[#a18d7a] focus:outline-none focus:ring-2 focus:ring-[#d2a46f]" placeholder="Digite aqui (ex.: profissão, data, número...)" value={d.detail||""} onChange={e=>changeJob(current.id,j=>({...j,docs:j.docs.map((x,n)=>n===i?{...x,detail:e.target.value}:x)}))}/></label>)}</div></div>)}
<label className="block text-sm">Observações<textarea rows={3} className={input} value={current.notes} onChange={e=>changeJob(current.id,j=>({...j,notes:e.target.value}))}/></label><button type="button" onClick={()=>completeExistingChecklist(current)} className="rounded-lg border border-[#967852] px-4 py-2.5 text-sm font-bold text-[#715735]">Adicionar itens do modelo revisado</button> <button onClick={()=>printJob(current)} className="inline-flex items-center gap-2 rounded-lg bg-[#10234d] px-4 py-2.5 text-sm font-bold text-white"><Printer size={16}/> Imprimir relatório / salvar PDF</button></section>}</>}
</div>
{current&&createPortal(<div className="mw-despachante-paper hidden">
<div className="letterhead"><div className="letterhead-logo"><svg viewBox="0 0 94 100" width="76" height="82" fill="none" stroke="#e8ae8c" strokeWidth="5" strokeLinejoin="round"><path d="M47 4 69 20v30l19-13v55L47 64 7 92V37l19 13V20Z"/><path d="M47 4v60M26 20v52M69 20v52M7 37l40 27 41-27M7 92l40-28 41 28"/></svg><small>DESPACHANTE IMOBILIÁRIO</small></div><span className="letterhead-wave"/></div>
<div className="print-body"><div className="print-watermark"><svg viewBox="0 0 94 100" fill="none" stroke="#f3d9cc" strokeWidth="5" strokeLinejoin="round"><path d="M47 4 69 20v30l19-13v55L47 64 7 92V37l19 13V20Z"/><path d="M47 4v60M26 20v52M69 20v52M7 37l40 27 41-27M7 92l40-28 41 28"/></svg></div>
<div className="print-heading"><p className="print-brand">MW DESPACHANTE · CONTROLE DOCUMENTAL</p><h1>RELATÓRIO DE CHECKLIST</h1><p>Conferência de documentos do atendimento</p></div>
<div className="print-ident"><p><b>Cliente:</b> {currentClient?.name||"—"}</p><p><b>Serviço:</b> {current!.title}</p><p><b>Data do cadastro:</b> {new Date(current!.created).toLocaleDateString("pt-BR")}</p><p><b>Vendedores:</b> {(current!.sellers||[]).join("; ")||"Não informado"}</p><p><b>Compradores:</b> {(current!.buyers||[]).join("; ")||"Não informado"}</p></div>
<div className="print-summary"><span><b>{current!.docs.length}</b> documentos</span><span><b>{current!.docs.filter(d=>d.status==="recebido"||(d.checked&&d.status!=="dispensado")).length}</b> recebidos</span><span><b>{current!.docs.filter(d=>d.status!=="dispensado"&&d.status!=="recebido"&&!d.checked).length}</b> pendentes</span><span><b>{current!.docs.filter(d=>d.status==="dispensado").length}</b> dispensados</span></div>
{Array.from(new Set(current!.docs.map(d=>d.group))).map(group=><section key={group} className="print-group"><h2>{group}</h2><table><thead><tr><th>Documento / informação</th><th>Situação</th></tr></thead><tbody>{current!.docs.filter(d=>d.group===group).map((d,i)=><tr key={i}><td><span className={d.status==="dispensado"?"print-struck":""}>{d.name}</span>{d.detail&&<span className="print-detail"> — {d.detail}</span>}</td><td className={d.status==="dispensado"?"exempt":(d.status==="recebido"||d.checked)?"received":"pending"}>{d.status==="dispensado"?"Dispensado":(d.status==="recebido"||d.checked)?"Recebido":"Pendente"}</td></tr>)}</tbody></table></section>)}
<section className="print-notes"><b>Observações</b><p>{current!.notes||"Nenhuma observação registrada."}</p></section><p className="print-signature">________________________________________<br/>Responsável pelo atendimento</p></div>
<div className="print-footer"><span>(89) 9 9930-8209</span><span>despachantemarcoswemerson@gmail.com<br/>marcoswemerson7@gmail.com</span><span>Ribeiro Gonçalves–PI<br/>Baixa Grande do Ribeiro–PI</span></div>
<style>{`@media print {
@page{size:A4 portrait;margin:0}
html,body{margin:0!important;padding:0!important;background:white!important;height:auto!important}#root{display:none!important}
body{overflow:visible!important}
.mw-despachante-paper,.mw-despachante-paper *{visibility:visible!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
.mw-despachante-paper{display:block!important;position:relative;left:0;top:0;width:210mm;min-height:297mm;color:#182640;background:white;font:10pt Arial,sans-serif;box-sizing:border-box;padding:39mm 14mm 27mm;break-after:auto}
.letterhead{position:absolute;top:0;left:0;width:210mm;height:32mm;background:#122452;display:flex;align-items:center;padding-left:17mm;box-sizing:border-box;overflow:hidden}
.letterhead-logo{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;position:relative;z-index:1}
.letterhead-logo svg{width:19mm;height:23mm}.letterhead-logo small{font-size:5pt;color:#fff;letter-spacing:1px}
.letterhead-wave{position:absolute;right:-10mm;bottom:-12mm;width:110mm;height:26mm;background:#806c49;border-radius:70% 0 0 0;transform:rotate(-4deg)}
.print-body{position:relative;z-index:1}
.print-watermark{position:absolute;right:-8mm;top:35mm;width:125mm;height:170mm;opacity:.47;z-index:-1}
.print-watermark svg{width:100%;height:100%}
.print-heading{text-align:center;margin:0 0 7mm}.print-heading .print-brand{color:#806c49;font-size:8pt;letter-spacing:1.7px;font-weight:bold}.print-heading h1{font-size:17pt;letter-spacing:.4px;margin:3mm 0 1mm}.print-heading p{margin:0;font-size:9pt}
.print-ident{border:1px solid #d9dfe8;border-left:3px solid #806c49;padding:4mm 5mm;background:rgba(255,255,255,.9);border-radius:2mm}.print-ident p{margin:1.3mm 0;line-height:1.5}
.print-summary{display:flex;gap:3mm;margin:5mm 0}.print-summary span{flex:1;border:1px solid #e4e7ec;padding:3mm;text-align:center;border-radius:2mm;background:#faf9f6}.print-summary b{font-size:12pt;color:#122452}
.print-group{margin:5mm 0;break-inside:avoid;page-break-inside:avoid}.print-group h2{font-size:10pt;background:#eee9e0;color:#443824;padding:2.5mm 3mm;margin:0 0 1mm}
.print-group table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.88)}.print-group th{text-align:left;border-bottom:1px solid #cfd5de;font-size:8pt;color:#58647a;padding:2mm}.print-group td{border-bottom:1px solid #e5e9ef;padding:2.2mm;line-height:1.3;font-size:9pt}.print-group td:last-child,.print-group th:last-child{width:25mm;text-align:center}.print-detail{color:#975c1d;font-weight:700;overflow-wrap:anywhere}.print-struck{text-decoration:line-through;color:#9299a4}.exempt{color:#6b7280;font-weight:bold}.received{color:#176744;font-weight:bold}.pending{color:#936726}
.print-notes{border-top:1px solid #cdd3dd;padding-top:3mm;margin-top:7mm;break-inside:avoid}.print-notes p{white-space:pre-wrap;overflow-wrap:anywhere}
.print-signature{text-align:center;margin-top:15mm;line-height:1.8;break-inside:avoid}
.print-footer{position:absolute;left:0;bottom:0;width:210mm;height:22mm;background:#806c49;color:white;display:flex;justify-content:space-around;align-items:center;padding:2mm 9mm;box-sizing:border-box;font-size:7.2pt;line-height:1.6}.print-footer span+span{border-left:1px solid white;padding-left:4mm}
}`}</style></div>, document.body)};
}
