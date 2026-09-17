import { appwriteConfig, functions } from "../lib/appwrite";
export const ACCESS_MODULES=[["dashboard","Visão geral"],["financeiro","Financeiro"],["sistemas","Sistemas e órgãos"],["usuarios","Usuários e acessos"],["armazenamento","Armazenamento"],["suporte","Central de suporte"],["configuracoes","Configurações"]] as const;
export type TeamAccess={id:string;nome:string;email:string;cargo:string;status:string;modulos:string[];created_at:string;updated_at:string};
async function execute(action:string,payload:Record<string,unknown>={}){if(!appwriteConfig.financialFunctionId)throw new Error("Função administrativa não configurada.");const execution=await functions.createExecution({functionId:appwriteConfig.financialFunctionId,body:JSON.stringify({action,...payload}),async:false});const body=execution.responseBody?JSON.parse(execution.responseBody):{};if(execution.status!=="completed"||body.error)throw new Error(body.error||"Operação não concluída.");return body}
const normalize=(row:any):TeamAccess=>({...row,id:row.$id||row.id,modulos:Array.isArray(row.modulos)?row.modulos:(()=>{try{return JSON.parse(row.modulos||"[]")}catch{return[]}})()});
export async function getTeamAccess(){const body=await execute("listStaff");return(body.rows||[]).map(normalize)}
export async function saveTeamAccess(values:Partial<TeamAccess>){const body=await execute("saveStaff",values);return normalize(body.row)}
export async function deleteTeamAccess(id:string){await execute("deleteStaff",{id})}
