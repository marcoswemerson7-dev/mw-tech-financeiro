import { Permission, Role } from "appwrite";
import { account, appwriteConfig, tables } from "../lib/appwrite";

const TABLE = "despachante_dados";
const MAX_BYTES = 950_000;
type Snapshot = { clients:unknown[]; models:unknown[]; jobs:unknown[] };
export async function getDespachanteUserId() {
  const user=await account.get();
  return user.$id;
}
export async function downloadDespachante():Promise<Snapshot|null>{
  const userId=await getDespachanteUserId();
  try {
    const row=await tables.getRow({databaseId:appwriteConfig.databaseId,tableId:TABLE,rowId:userId});
    const parsed=JSON.parse(String(row.payload||""));
    if(!Array.isArray(parsed.clients)||!Array.isArray(parsed.models)||!Array.isArray(parsed.jobs))throw Error("Dados da nuvem inválidos");
    return parsed as Snapshot;
  } catch(error) {
    if(Number((error as {code?:number}).code)===404)return null;
    throw error;
  }
}
export async function uploadDespachante(data:Snapshot) {
 const userId=await getDespachanteUserId();
 const payload=JSON.stringify(data);
 if(new TextEncoder().encode(payload).length>MAX_BYTES)throw Error("Os dados excedem o limite para sincronização. Contate o suporte MW TECH.");
 const args={databaseId:appwriteConfig.databaseId,tableId:TABLE,rowId:userId};
 try {
   await tables.getRow(args);
   await tables.updateRow({...args,data:{payload}});
 } catch(error){
   if(Number((error as {code?:number}).code)!==404)throw error;
   await tables.createRow({...args,data:{owner_id:userId,payload},permissions:[Permission.read(Role.user(userId)),Permission.update(Role.user(userId)),Permission.delete(Role.user(userId))]});
 }
}
