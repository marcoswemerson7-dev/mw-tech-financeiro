import { Client, Permission, Role, Storage, TablesDB } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || "mw-tech-financeiro";
if (!projectId || !apiKey) throw new Error("Defina APPWRITE_PROJECT_ID e APPWRITE_API_KEY no terminal.");
const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new TablesDB(client), storage = new Storage(client);
const auth = Role.users();
const permissions = [Permission.read(auth), Permission.create(auth), Permission.update(auth), Permission.delete(auth)];
type Col = { key: string; type: string; size?: number; required?: boolean; default?: unknown };
const s = (key: string, size = 255, required = false, value?: string): Col => ({ key, type: size > 16384 ? "text" : "varchar", size, required, ...(value === undefined ? {} : { default: value }) });
const f = (key: string, required = false, value?: number): Col => ({ key, type: "double", required, ...(value === undefined ? {} : { default: value }) });
const b = (key: string, value = false): Col => ({ key, type: "boolean", required: false, default: value });
const dt = (key: string, required = false): Col => ({ key, type: "datetime", required });
const tables = [
  { id: "profiles", name: "Perfis", columns: [s("user_id",36,true),s("nome"),s("email",320,true),s("role",30,false,"admin"),b("ativo",true),dt("created_at",true)], indexes:[{key:"user_unique",type:"unique",attributes:["user_id"]}] },
  { id: "contas_financeiras", name: "Contas financeiras", columns: [s("nome",120,true),s("tipo",30,true),s("banco",120),s("codigo_banco",10),s("agencia",30),s("numero_conta",50),f("saldo_inicial",true),f("saldo_atual",true),s("cor",20),b("ativo",true),dt("created_at",true),dt("updated_at",true)], indexes:[{key:"contas_nome",type:"key",attributes:["nome"]}] },
  { id: "categorias_financeiras", name: "Categorias financeiras", columns: [s("nome",100,true),s("tipo",30,true),b("ativo",true)], indexes:[{key:"categoria_tipo",type:"key",attributes:["tipo"]}] },
  { id: "partes_financeiras", name: "Partes financeiras", columns: [s("nome",180,true),s("tipo",30,true),s("documento",30),s("observacao",2048),b("ativo",true),dt("created_at",true)], indexes:[{key:"parte_nome",type:"key",attributes:["nome"]},{key:"parte_tipo",type:"key",attributes:["tipo"]}] },
  { id: "movimentacoes_financeiras", name: "Movimentações financeiras", columns: [s("tipo",30,true),dt("data",true),s("descricao",255,true),s("categoria_id",36),s("conta_id",36,true),s("conta_destino_id",36),f("valor",true),s("observacao",32768),s("comprovante_id",36),s("despesa_id",36),s("pagamento_id",36),s("created_by",36,true),s("idempotency_key",36,true),dt("created_at",true)], indexes:[{key:"mov_data",type:"key",attributes:["data"]},{key:"mov_conta",type:"key",attributes:["conta_id"]},{key:"mov_idempotency",type:"unique",attributes:["idempotency_key"]}] },
  { id: "despesas", name: "Despesas", columns: [s("descricao",255,true),s("categoria_id",36),s("categoria",100),dt("competencia",true),dt("vencimento",true),f("valor",true),s("conta_id",36),s("fornecedor",180),s("observacao",32768),s("status",30,true),b("recorrente"),s("recorrencia_id",36),dt("data_pagamento"),s("comprovante_id",36),s("created_by",36,true),dt("created_at",true),dt("updated_at",true)], indexes:[{key:"despesa_vencimento",type:"key",attributes:["vencimento"]},{key:"despesa_status",type:"key",attributes:["status"]},{key:"despesa_recorrencia",type:"key",attributes:["recorrencia_id"]}] },
  { id: "despesas_recorrencias", name: "Despesas recorrentes", columns: [s("descricao",255,true),s("categoria_id",36),s("conta_id",36),f("valor",true),{key:"dia_vencimento",type:"integer",required:true},dt("data_inicio",true),dt("data_fim"),b("ativo",true),dt("created_at",true)], indexes:[{key:"recorrencia_ativa",type:"key",attributes:["ativo"]}] },
  { id: "pagamentos_despesas", name: "Pagamentos de despesas", columns: [s("despesa_id",36,true),s("conta_id",36,true),f("valor",true),dt("data_pagamento",true),s("comprovante_id",36),s("observacao",32768),s("created_by",36,true),b("estornado"),dt("created_at",true),dt("estornado_at"),s("idempotency_key",36,true)], indexes:[{key:"pagamento_despesa",type:"key",attributes:["despesa_id"]},{key:"pagamento_idempotency",type:"unique",attributes:["idempotency_key"]}] },
  { id: "configuracoes_empresa", name: "Configurações da empresa", columns: ["nome_empresa","razao_social","cnpj","telefone","email","endereco","cidade","estado","pix","banco","agencia","conta","logo_url"].map(k=>s(k,k==="endereco"||k==="logo_url"?2048:255)) },
  { id: "operacoes_idempotentes", name: "Operações idempotentes", columns: [s("action",40,true),s("user_id",36,true),s("result_id",36),dt("created_at",true)] },
];
async function exists(run:()=>Promise<unknown>) { try { await run(); return true; } catch (e:any) { if (e?.code === 404) return false; throw e; } }
if (!(await exists(()=>db.get({ databaseId })))) await db.create({ databaseId, name: "MW TECH Financeiro" });
for (const table of tables) {
  if (await exists(()=>db.getTable({databaseId,tableId:table.id}))) { console.log(`= ${table.id}`); continue; }
  await db.createTable({ databaseId, tableId:table.id, name:table.name, permissions, rowSecurity:false, columns:table.columns, indexes:table.indexes || [] });
  console.log(`+ ${table.id}`);
}
if (!(await exists(()=>storage.getBucket({bucketId:"comprovantes"})))) {
  await storage.createBucket({ bucketId:"comprovantes", name:"Comprovantes", permissions, fileSecurity:false, enabled:true,
    maximumFileSize:10_000_000, allowedFileExtensions:["pdf","jpg","jpeg","png"], encryption:true, antivirus:true });
  console.log("+ comprovantes");
}
console.log(`Setup concluído. Database ID: ${databaseId}`);
