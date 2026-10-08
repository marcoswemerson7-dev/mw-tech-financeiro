// Arquivo financeiro privado; credenciais permanecem exclusivamente no servidor.
export const maxDuration = 60;
const FOLDER_ID = "1WU5KkOOdq4v1OnNaO8gJEWsI5Emi-yna";
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_SIZE = 8 * 1024 * 1024;
type Req = { method?: string; headers: Record<string,string | string[] | undefined>; body?: any; query?: Record<string,string> };
type Res = { setHeader: (k:string,v:string)=>void; status:(n:number)=>Res; json:(x:unknown)=>void };
async function authorize(req: Req) {
  const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i,"").trim();
  if (!jwt) throw new Error("Faça login no sistema para acessar notas fiscais.");
  const project = process.env.VITE_APPWRITE_PROJECT_ID;
  const endpoint = process.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  if (!project) throw new Error("Appwrite não configurado no servidor.");
  const response = await fetch(endpoint.replace(/\/$/,"")+"/account", { headers: { "X-Appwrite-Project": project, "X-Appwrite-JWT": jwt } });
  if (!response.ok) throw new Error("Sessão inválida ou expirada.");
  const user = await response.json();
  const allowed = (process.env.MW_FINANCE_DRIVE_ALLOWED_EMAILS || "").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) throw new Error("Acesso privado às notas ainda não configurado.");
  if (!allowed.includes(String(user.email || "").toLowerCase())) throw new Error("Acesso às notas fiscais não autorizado.");
}
async function googleToken() {
  const { GOOGLE_DRIVE_CLIENT_ID:id, GOOGLE_DRIVE_CLIENT_SECRET:secret, GOOGLE_DRIVE_REFRESH_TOKEN:refresh } = process.env;
  if (!id || !secret || !refresh) throw new Error("A conexão de envio ao Google Drive ainda precisa ser autorizada.");
  const response = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:id,client_secret:secret,refresh_token:refresh,grant_type:"refresh_token"})});
  const data = await response.json();
  if(!response.ok || !data.access_token) throw new Error("Não foi possível renovar a autorização do Google Drive.");
  return String(data.access_token);
}
export default async function handler(req:Req,res:Res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method !== "GET" && req.method !== "POST") return res.status(405).json({error:"Método não permitido."});
  try {
    await authorize(req);
    const token = await googleToken();
    if(req.method === "GET") {
      const q = new URLSearchParams({q:"'"+FOLDER_ID+"' in parents and trashed = false",fields:"nextPageToken,files(id,name,mimeType,size,createdTime,webViewLink)",page_size:"100",orderBy:"createdTime desc"});
      const r=await fetch("https://www.googleapis.com/drive/v3/files?"+q,{headers:{Authorization:"Bearer "+token}});
      const data=await r.json();
      if(!r.ok) throw new Error("Falha ao listar notas fiscais no Google Drive.");
      return res.status(200).json({files:data.files || [],nextPageToken:data.nextPageToken || null});
    }
    const {name,mimeType,data:encoded}=req.body || {};
    if(typeof name!=="string" || typeof encoded!=="string" || !ALLOWED.has(mimeType)) return res.status(400).json({error:"Envie PDF, PNG ou JPG."});
    const bytes=Buffer.from(encoded,"base64");
    if(!bytes.length || bytes.length>MAX_SIZE) return res.status(400).json({error:"O arquivo deve ter até 8 MB."});
    const safeName=name.replace(/[\\/\u0000-\u001f]/g,"_").slice(0,160);
    const form=new FormData();
    form.append("metadata",new Blob([JSON.stringify({name:safeName,parents:[FOLDER_ID]})],{type:"application/json"}));
    form.append("file",new Blob([bytes],{type:mimeType}),safeName);
    const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
    if(!r.ok) throw new Error("Não foi possível salvar a nota no Google Drive.");
    const file=await r.json();
    return res.status(201).json({file});
  } catch(e:any) { const msg=String(e?.message || "Falha na integração."); res.status(/autorizado|Sessão|login/.test(msg)?403:503).json({error:msg}); }
}
