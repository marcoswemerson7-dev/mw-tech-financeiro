import { Client, Query, TablesDB } from "node-appwrite";
export default async ({req,res,error})=>{
  const userId=req.headers["x-appwrite-user-id"];if(!userId)return res.json({error:"Usuário não autenticado."},401);
  const client=new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
  const db=new TablesDB(client),databaseId=process.env.APPWRITE_DATABASE_ID,now=new Date(),created=[];
  try{
    const list=await db.listRows({databaseId,tableId:"despesas_recorrencias",queries:[Query.equal("ativo",true),Query.limit(500)]});
    for(const r of list.rows){
      const start=new Date(r.data_inicio),end=r.data_fim?new Date(r.data_fim):null;
      if(start>now||(end&&end<now))continue;
      const due=new Date(now.getFullYear(),now.getMonth(),Math.min(Number(r.dia_vencimento),28),12);
      const competence=new Date(now.getFullYear(),now.getMonth(),1,12),key=`${r.$id.slice(0,25)}-${String(now.getFullYear())}${String(now.getMonth()+1).padStart(2,"0")}`;
      try{await db.getRow({databaseId,tableId:"despesas",rowId:key});continue}catch(e){if(e.code!==404)throw e}
      await db.createRow({databaseId,tableId:"despesas",rowId:key,data:{descricao:`${r.descricao} - ${competence.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}`,categoria_id:r.categoria_id||"",categoria:"",competencia:competence.toISOString(),vencimento:due.toISOString(),valor:Number(r.valor),conta_id:r.conta_id||"",fornecedor:"",observacao:"Gerada automaticamente",status:"pendente",recorrente:true,recorrencia_id:r.$id,data_pagamento:"",comprovante_id:"",created_by:userId,created_at:now.toISOString(),updated_at:now.toISOString()}});created.push(key);
    }
    return res.json({ok:true,created});
  }catch(e){error(e.message);return res.json({error:e.message||"Erro interno."},400)}
};
