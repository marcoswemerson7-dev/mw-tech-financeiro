import { ID } from "appwrite";
import { appwriteConfig, functions } from "../lib/appwrite";
export const ACCESS_MODULES=[["dashboard","Visão geral"],["financeiro","Financeiro"],["sistemas","Sistemas e órgãos"],["usuarios","Usuários e acessos"],["armazenamento","Armazenamento"],["suporte","Central de suporte"],["configuracoes","Configurações"]] as const;
export type TeamAccess={id:string;nome:string;email:string;cpf?:string;cargo:string;status:string;modulos:string[];created_at:string;updated_at:string;auth_user_id?:string;login_criado?:boolean;senha_inicial?:string};
async function execute(action:string,payload:Record<string,unknown>={}){if(!appwriteConfig.financialFunctionId)throw new Error("Função administrativa não configurada.");const execution=await functions.createExecution({functionId:appwriteConfig.financialFunctionId,body:JSON.stringify({action,idempotencyKey:ID.unique(),...payload}),async:false});let body:Record<string,any>={};try{body=execution.responseBody?JSON.parse(execution.responseBody):{}}catch{body={}}if(execution.status!=="completed"||body.error){const executionError=String((execution as unknown as {errors?:string}).errors||"").trim();throw new Error(body.error||executionError||"Operação não concluída.")}return body}
const normalize=(row:any):TeamAccess=>({...row,id:row.$id||row.id,modulos:Array.isArray(row.modulos)?row.modulos:(()=>{try{return JSON.parse(row.modulos||"[]")}catch{return[]}})()});
export async function getTeamAccess(){const body=await execute("listStaff");return(body.rows||[]).map(normalize)}
export async function saveTeamAccess(values:Partial<TeamAccess>){const body=await execute("saveStaff",values);return normalize(body.row)}
export async function deleteTeamAccess(id:string){await execute("deleteStaff",{id})}
