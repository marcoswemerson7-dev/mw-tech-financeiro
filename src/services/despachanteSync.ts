import { Permission, Query, Role } from "appwrite";
import { account, appwriteConfig, tables } from "../lib/appwrite";

const TABLE = "despachante_dados";
// The Appwrite Text column is capped at 16,383 characters. Store independent,
// immutable chunks and publish the manifest LAST to make uploads recoverable.
const CHUNK_SIZE = 12000;
type Snapshot = { clients:unknown[]; models:unknown[]; jobs:unknown[] };
type Manifest = { version:2; chunks:string[]; updatedAt:string };
const encode = (s:string) => btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(""));
const decode = (s:string) => new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
const chunksOf=(s:string)=>Array.from({length:Math.ceil(s.length/CHUNK_SIZE)},(_,i)=>s.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE));
async function userId(){return (await account.get()).$id;}
const perms=(owner:string)=>[Permission.read(Role.user(owner)),Permission.update(Role.user(owner)),Permission.delete(Role.user(owner))];
async function readRow(rowId:string){return tables.getRow({databaseId:appwriteConfig.databaseId,tableId:TABLE,rowId});}
async function saveRow(rowId:string,owner:string,payload:string){
 const args={databaseId:appwriteConfig.databaseId,tableId:TABLE,rowId};
 try{await readRow(rowId);await tables.updateRow({...args,data:{payload}});}
 catch(e){if(Number((e as {code?:number}).code)!==404)throw e;
 await tables.createRow({...args,data:{owner_id:owner,payload},permissions:perms(owner)});}
}
function valid(value:unknown):value is Snapshot {
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 return Array.isArray(d.clients)&&Array.isArray(d.models)&&Array.isArray(d.jobs);
}
export async function downloadDespachante():Promise<Snapshot|null>{
 const owner=await userId();
 let head;
 try{head=await readRow(owner);}catch(e){if(Number((e as {code?:number}).code)===404)return null;throw e;}
 const text=String(head.payload||"");
 const parsed=JSON.parse(text) as Manifest | Snapshot;
 if(valid(parsed))return parsed; // Backwards-compatible with legacy single-row snapshots.
 if(parsed.version!==2||!Array.isArray(parsed.chunks)||parsed.chunks.length>300)
  throw Error("Manifesto da nuvem inválido");
 const parts=await Promise.all(parsed.chunks.map(async id=>{
  const row=await readRow(id);
  if(row.owner_id!==owner)throw Error("Proprietário do bloco inválido");
  return String(row.payload||"");
 }));
 const snapshot=JSON.parse(decode(parts.join("")));
 if(!valid(snapshot))throw Error("Dados recebidos da nuvem inválidos");
 return snapshot;
}
export async function uploadDespachante(data:Snapshot){
 const owner=await userId();
 const encoded=encode(JSON.stringify(data));
 const parts=chunksOf(encoded);
 if(parts.length>300)throw Error("Limite de dados excedido; exporte um backup antes de continuar.");
 const batch=crypto.randomUUID().replace(/-/g,"").slice(0,12);
 const ids:string[]=[];
 for(let i=0;i<parts.length;i++){
  const rowId="dc_"+batch+"_"+i;
  await saveRow(rowId,owner,parts[i]);
  ids.push(rowId);
 }
 // The manifest changes only after all new chunks have been written.
 const manifest:Manifest={version:2,chunks:ids,updatedAt:new Date().toISOString()};
 await saveRow(owner,owner,JSON.stringify(manifest));
}
