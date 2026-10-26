import { Permission, Role } from "appwrite";
import { account, appwriteConfig, tables } from "../lib/appwrite";

const TABLE="agenda_dados";
const CHUNK_SIZE=11000;
export type AgendaSnapshot={version:3;items:unknown[];pages:Record<string,string>;ink:Record<string,unknown[]>;tasks?:unknown[]};
const encode=(s:string)=>btoa(Array.from(new TextEncoder().encode(s),c=>String.fromCharCode(c)).join(""));
const decode=(s:string)=>new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
const ownerId=async()=>(await account.get()).$id;
const permissions=(id:string)=>[Permission.read(Role.user(id)),Permission.update(Role.user(id)),Permission.delete(Role.user(id))];
const getRow=(id:string)=>tables.getRow({databaseId:appwriteConfig.databaseId,tableId:TABLE,rowId:id});
async function put(id:string,owner:string,payload:string){
 const args={databaseId:appwriteConfig.databaseId,tableId:TABLE,rowId:id};
 try{await getRow(id);await tables.updateRow({...args,data:{payload}});}
 catch(error){
  if(Number((error as {code?:number}).code)!==404)throw error;
  await tables.createRow({...args,data:{owner_id:owner,payload},permissions:permissions(owner)});
 }
}
function check(value:unknown):value is AgendaSnapshot {
 if(!value||typeof value!=="object")return false;
 const obj=value as Record<string,unknown>;
 return Array.isArray(obj.items)&&!!obj.pages&&typeof obj.pages==="object"&&!Array.isArray(obj.pages)&&!!obj.ink&&typeof obj.ink==="object"&&!Array.isArray(obj.ink);
}
export async function readAgendaCloud():Promise<{data:AgendaSnapshot;revision:string}|null>{
 const owner=await ownerId();
 let root;
 try{root=await getRow(owner);}catch(e){if(Number((e as {code?:number}).code)===404)return null;throw e;}
 const manifest=JSON.parse(String(root.payload||"")) as {version:1;parts:string[]};
 if(manifest.version!==1||!Array.isArray(manifest.parts)||manifest.parts.length>500)throw Error("Índice de dados da agenda inválido");
 const parts=await Promise.all(manifest.parts.map(async id=>{
  const row=await getRow(id);
  if(row.owner_id!==owner)throw Error("Permissão do bloco inválida");
  return String(row.payload||"");
 }));
 const data=JSON.parse(decode(parts.join("")));
 if(!check(data))throw Error("Dados da agenda inválidos");
 return {data,revision:String(root.$updatedAt||"")};
}
export async function writeAgendaCloud(data:AgendaSnapshot,expectedRevision?:string){
 const owner=await ownerId();
 const encoded=encode(JSON.stringify(data));
 const parts=Array.from({length:Math.ceil(encoded.length/CHUNK_SIZE)},(_,i)=>encoded.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE));
 if(parts.length>500)throw Error("Agenda excede o limite atual de armazenamento.");
 const batch=crypto.randomUUID().replace(/-/g,"").slice(0,14);
 const ids:string[]=[];
 for(let i=0;i<parts.length;i++){
  const id="ag_"+batch+"_"+i;
  await put(id,owner,parts[i]);
  ids.push(id);
 }
 let revision="";
 try{revision=String((await getRow(owner)).$updatedAt||"");}
 catch(e){if(Number((e as {code?:number}).code)!==404)throw e;}
 if(expectedRevision!==undefined&&revision!==expectedRevision)throw Error("A agenda foi alterada em outro dispositivo. Recarregue a versão da nuvem antes de enviar.");
 await put(owner,owner,JSON.stringify({version:1,parts:ids,createdAt:new Date().toISOString()}));
}
