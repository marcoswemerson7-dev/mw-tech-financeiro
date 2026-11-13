import { account } from "../lib/appwrite";
const endpoint=String(import.meta.env.VITE_MW_SUPABASE_URL||"").replace(/\/$/,"")+"/functions/v1/mw-despachante-anexos";
export type ProcessAttachment={key:string;name:string;size:number;created_at:string;contentType:string};
async function request(action:"list"|"upload"|"download"|"delete",processId:string,extra?:{key?:string;file?:File}){
 if(!import.meta.env.VITE_MW_SUPABASE_URL)throw new Error("Supabase não está configurado neste ambiente.");
 const jwt=await account.createJWT();
 const body=new FormData();body.append("action",action);body.append("processId",processId);
 if(extra?.key)body.append("key",extra.key);
 if(extra?.file)body.append("file",extra.file);
 const res=await fetch(endpoint,{method:"POST",headers:{"X-Appwrite-JWT":jwt.jwt},body});
 const data=await res.json().catch(()=>({})) as {error?:string;files?:ProcessAttachment[];url?:string};
 if(!res.ok)throw new Error(data.error||"Não foi possível acessar anexos.");
 return data;
}
export async function listProcessAttachments(processId:string){return (await request("list",processId)).files||[];}
export async function uploadProcessAttachment(processId:string,file:File){await request("upload",processId,{file});}
export async function openProcessAttachment(processId:string,key:string){const result=await request("download",processId,{key});if(!result.url)throw new Error("Link seguro não disponível.");return result.url;}
export async function deleteProcessAttachment(processId:string,key:string){await request("delete",processId,{key});}
