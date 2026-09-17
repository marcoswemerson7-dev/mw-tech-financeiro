import { appwriteConfig, functions } from "../lib/appwrite";

export type ManagedSystem = {
  id: string; orgao: string; tipo_orgao: string; sistema: string; dominio_url?: string;
  vercel_url?: string; acesso_url?: string; ambiente: string; status: string; observacao?: string;
  created_at: string; updated_at: string;
};
async function execute(action: string, payload: Record<string, unknown> = {}) {
  if (!appwriteConfig.financialFunctionId) throw new Error("Função administrativa não configurada.");
  const execution = await functions.createExecution({ functionId: appwriteConfig.financialFunctionId, body: JSON.stringify({ action, ...payload }), async: false });
  const body = execution.responseBody ? JSON.parse(execution.responseBody) : {};
  if (execution.status !== "completed" || body.error) throw new Error(body.error || "Operação não concluída.");
  return body;
}
const normalize=(row:any):ManagedSystem=>({...row,id:row.$id||row.id});
export async function getManagedSystems(){const body=await execute("listSystems");return (body.rows||[]).map(normalize)}
export async function saveManagedSystem(values:Partial<ManagedSystem>){const body=await execute("saveSystem",values);return normalize(body.row)}
export async function deleteManagedSystem(id:string){await execute("deleteSystem",{id})}
