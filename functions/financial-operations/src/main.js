import { Client, ID, Query, TablesDB } from "node-appwrite";

const gb=value=>Math.round((Number(value||0)/1024/1024/1024)*100)/100;
async function googleAccessToken(){
  const clientId=process.env.GOOGLE_DRIVE_CLIENT_ID,clientSecret=process.env.GOOGLE_DRIVE_CLIENT_SECRET,refreshToken=process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if(!clientId||!clientSecret||!refreshToken)throw new Error("Integração com o Google Drive ainda não configurada.");
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"})});
  const data=await response.json();if(!response.ok||!data.access_token)throw new Error(data.error_description||"Não foi possível autenticar no Google Drive.");return data.access_token;
}
async function driveJson(token,url){const response=await fetch(url,{headers:{authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"Falha ao consultar o Google Drive.");return data}
async function folderUsage(token,rootId){
  let bytes=0,files=0,folders=0;const queue=[rootId],seen=new Set();
  while(queue.length){const folderId=queue.shift();if(!folderId||seen.has(folderId))continue;seen.add(folderId);let pageToken="";
    do{const params=new URLSearchParams({q:`'${folderId}' in parents and trashed = false`,fields:"nextPageToken,files(id,mimeType,size)",pageSize:"1000",supportsAllDrives:"true",includeItemsFromAllDrives:"true"});if(pageToken)params.set("pageToken",pageToken);const data=await driveJson(token,`https://www.googleapis.com/drive/v3/files?${params}`);for(const file of data.files||[]){if(file.mimeType==="application/vnd.google-apps.folder"){folders++;queue.push(file.id)}else{files++;bytes+=Number(file.size||0)}}pageToken=data.nextPageToken||""}while(pageToken);
  }
  return{bytes,usedGb:gb(bytes),files,folders};
}
async function getDriveStorage(){
  const token=await googleAccessToken();const about=await driveJson(token,"https://www.googleapis.com/drive/v3/about?fields=storageQuota");const quota=about.storageQuota||{},limit=Number(quota.limit||0),usage=Number(quota.usage||0);let configuredFolders=[];
  try{configuredFolders=JSON.parse(process.env.GOOGLE_DRIVE_FOLDERS||"[]")}catch{throw new Error("GOOGLE_DRIVE_FOLDERS possui JSON inválido.")}
  const folders=[];for(const item of configuredFolders){if(!item?.id||!item?.name)continue;const stats=await folderUsage(token,item.id);folders.push({id:item.id,name:item.name,...stats,percentOfTotal:limit?Math.round((stats.bytes/limit)*1000)/10:0})}
  return{ok:true,totalGb:gb(limit),usedGb:gb(usage),availableGb:gb(Math.max(limit-usage,0)),percent:limit?Math.round((usage/limit)*1000)/10:0,folders,updatedAt:new Date().toISOString()};
}
const T={accounts:"contas_financeiras",moves:"movimentacoes_financeiras",expenses:"despesas",payments:"pagamentos_despesas",ops:"operacoes_idempotentes",systems:"sistemas_orgaos",staff:"usuarios_acessos"};
export default async ({req,res,error})=>{
  const userId=req.headers["x-appwrite-user-id"];
  if(!userId)return res.json({error:"Usuário não autenticado."},401);
  let input;try{input=JSON.parse(req.body||"{}");}catch{return res.json({error:"JSON inválido."},400)}
  const {action,idempotencyKey}=input;
  if(action==="getDriveStorage"){try{return res.json(await getDriveStorage())}catch(e){error(e.message);return res.json({error:e.message||"Erro ao consultar o Google Drive."},400)}}
  const adminActions=["listSystems","saveSystem","deleteSystem","listStaff","saveStaff","deleteStaff"];
  if(!idempotencyKey&&!adminActions.includes(action))return res.json({error:"Chave de idempotência obrigatória."},400);
  const client=new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
  const db=new TablesDB(client),databaseId=process.env.APPWRITE_DATABASE_ID;
  try{
    if(adminActions.includes(action)){
      const adminIds=String(process.env.CONTROL_ADMIN_USER_IDS||"").split(",").map(x=>x.trim()).filter(Boolean),isAdmin=adminIds.includes(userId);
      const requireAdmin=()=>{if(!isAdmin)throw new Error("Acesso exclusivo do administrador do MW TECH Control.")};
      if(action==="listSystems"){const result=await db.listRows({databaseId,tableId:T.systems,queries:[Query.orderAsc("orgao"),Query.limit(200)]});return res.json({ok:true,rows:result.rows})}
      if(action==="listStaff"){requireAdmin();const result=await db.listRows({databaseId,tableId:T.staff,queries:[Query.orderAsc("nome"),Query.limit(200)]});return res.json({ok:true,rows:result.rows})}
      requireAdmin();const now=new Date().toISOString();
      if(action==="saveSystem"){const data={orgao:input.orgao||"",tipo_orgao:input.tipo_orgao||"Prefeitura",sistema:input.sistema||"Gestão Licita",dominio_url:input.dominio_url||"",vercel_url:input.vercel_url||"",acesso_url:input.acesso_url||input.dominio_url||"",ambiente:input.ambiente||"Produção",status:input.status||"ativo",observacao:input.observacao||"",updated_at:now};const row=input.id?await db.updateRow({databaseId,tableId:T.systems,rowId:input.id,data}):await db.createRow({databaseId,tableId:T.systems,rowId:ID.unique(),data:{...data,created_at:now}});return res.json({ok:true,row})}
      if(action==="deleteSystem"){await db.deleteRow({databaseId,tableId:T.systems,rowId:input.id});return res.json({ok:true})}
      if(action==="saveStaff"){const data={nome:input.nome||"",email:input.email||"",cargo:input.cargo||"Colaborador",status:input.status||"ativo",modulos:JSON.stringify(input.modulos||[]),updated_at:now};const row=input.id?await db.updateRow({databaseId,tableId:T.staff,rowId:input.id,data}):await db.createRow({databaseId,tableId:T.staff,rowId:ID.unique(),data:{...data,created_at:now}});return res.json({ok:true,row})}
      if(action==="deleteStaff"){await db.deleteRow({databaseId,tableId:T.staff,rowId:input.id});return res.json({ok:true})}
    }
    try{const done=await db.getRow({databaseId,tableId:T.ops,rowId:idempotencyKey});return res.json({ok:true,id:done.result_id,replayed:true})}catch(e){if(e.code!==404)throw e}
    const tx=await db.createTransaction();const tid=tx.$id,now=new Date().toISOString();
    const get=(tableId,rowId)=>db.getRow({databaseId,tableId,rowId,transactionId:tid});
    const update=(tableId,rowId,data)=>db.updateRow({databaseId,tableId,rowId,data,transactionId:tid});
    const create=(tableId,rowId,data)=>db.createRow({databaseId,tableId,rowId,data,transactionId:tid});
    const remove=(tableId,rowId)=>db.deleteRow({databaseId,tableId,rowId,transactionId:tid});
    const positive=v=>{v=Number(v);if(!Number.isFinite(v)||v<=0)throw new Error("O valor deve ser maior que zero.");return v};
    const applyEffect=async(move,sign=1,allowNegative=false)=>{
      const value=positive(move.valor),origin=await get(T.accounts,move.conta_id);
      const transfer=move.tipo==="transferencia",out=move.tipo==="saida"||transfer;
      const delta=(out?-value:value)*sign;
      const next=Number(origin.saldo_atual)+delta;
      if(next<0&&!allowNegative)throw new Error("Saldo insuficiente para concluir a alteração.");
      await update(T.accounts,origin.$id,{saldo_atual:next,updated_at:now});
      if(transfer){
        if(!move.conta_destino_id||move.conta_destino_id===origin.$id)throw new Error("Informe uma conta de destino diferente.");
        const dest=await get(T.accounts,move.conta_destino_id);
        const destNext=Number(dest.saldo_atual)+(value*sign);
        if(destNext<0&&!allowNegative)throw new Error("Saldo insuficiente na conta de destino para desfazer a transferência.");
        await update(T.accounts,dest.$id,{saldo_atual:destNext,updated_at:now});
      }
    };
    let resultId="";
    if(action==="registerMovement"||action==="transfer"){
      const value=positive(input.valor),origin=await get(T.accounts,input.conta_id);
      const transfer=action==="transfer",out=input.tipo==="saida"||transfer;
      if(out&&Number(origin.saldo_atual)<value)throw new Error("Saldo insuficiente.");
      await update(T.accounts,origin.$id,{saldo_atual:Number(origin.saldo_atual)+(out?-value:value),updated_at:now});
      if(transfer){if(!input.conta_destino_id||input.conta_destino_id===origin.$id)throw new Error("Informe uma conta de destino diferente.");const dest=await get(T.accounts,input.conta_destino_id);await update(T.accounts,dest.$id,{saldo_atual:Number(dest.saldo_atual)+value,updated_at:now});}
      resultId=ID.unique();await create(T.moves,resultId,{tipo:transfer?"transferencia":input.tipo,data:new Date(input.data).toISOString(),descricao:input.descricao,categoria_id:input.categoria_id||"",conta_id:origin.$id,conta_destino_id:input.conta_destino_id||"",valor:value,observacao:input.observacao||"",comprovante_id:input.comprovante_id||"",despesa_id:"",pagamento_id:"",created_by:userId,idempotency_key:idempotencyKey,created_at:now});
    }else if(action==="updateMovement"){
      const move=await get(T.moves,input.movimentacao_id);
      if(move.despesa_id||move.pagamento_id)throw new Error("Movimentações geradas por despesas/pagamentos devem ser alteradas pela tela de Despesas.");
      await applyEffect(move,-1);
      const next={...move,tipo:input.tipo||move.tipo,data:new Date(input.data||move.data).toISOString(),descricao:input.descricao??move.descricao,conta_id:input.conta_id||move.conta_id,conta_destino_id:input.conta_destino_id??move.conta_destino_id,valor:positive(input.valor??move.valor),observacao:input.observacao??move.observacao,comprovante_id:input.comprovante_id??move.comprovante_id};
      await applyEffect(next,1);
      resultId=move.$id;
      await update(T.moves,move.$id,{tipo:next.tipo,data:next.data,descricao:next.descricao,conta_id:next.conta_id,conta_destino_id:next.conta_destino_id||"",valor:next.valor,observacao:next.observacao||"",comprovante_id:next.comprovante_id||"",updated_at:now});
    }else if(action==="deleteMovement"){
      const move=await get(T.moves,input.movimentacao_id);
      if(move.pagamento_id){
        let payment=null;try{payment=await get(T.payments,move.pagamento_id)}catch(e){if(e.code!==404)throw e}
        if(payment){
          if(!payment.estornado)await applyEffect(move,-1,true);
          if(move.despesa_id){try{const expense=await get(T.expenses,move.despesa_id);await update(T.expenses,expense.$id,{status:"pendente",data_pagamento:"",updated_at:now});}catch(e){if(e.code!==404)throw e}}
          await remove(T.payments,payment.$id);
        }
        resultId=move.$id;await remove(T.moves,move.$id);
      }else if(move.despesa_id){
        const linkedMoves=await db.listRows({databaseId,tableId:T.moves,queries:[Query.equal("despesa_id",move.despesa_id)],transactionId:tid});
        const linkedPayments=await db.listRows({databaseId,tableId:T.payments,queries:[Query.equal("despesa_id",move.despesa_id)],transactionId:tid});
        for(const linked of linkedMoves.rows)if(linked.pagamento_id&&linked.tipo!=="estorno")await applyEffect(linked,-1,true);
        resultId=move.$id;
        for(const linked of linkedMoves.rows)await remove(T.moves,linked.$id);
        for(const payment of linkedPayments.rows)await remove(T.payments,payment.$id);
      }
      else{
      await applyEffect(move,-1,true);resultId=move.$id;await remove(T.moves,move.$id);
      }
    }else if(action==="updateExpense"){
      const expense=await get(T.expenses,input.despesa_id);
      if(expense.status==="pago")throw new Error("Estorne o pagamento antes de editar uma despesa paga.");
      resultId=expense.$id;
      await update(T.expenses,expense.$id,{descricao:input.descricao??expense.descricao,categoria:input.categoria??expense.categoria,competencia:input.competencia?new Date(input.competencia).toISOString():expense.competencia,vencimento:input.data_vencimento?new Date(input.data_vencimento).toISOString():expense.vencimento,valor:positive(input.valor??expense.valor),conta_id:input.conta_id??expense.conta_id,fornecedor:input.fornecedor??expense.fornecedor,observacao:input.observacao??expense.observacao,updated_at:now});
    }else if(action==="cancelExpense"){
      const expense=await get(T.expenses,input.despesa_id);
      if(expense.status==="pago")throw new Error("Estorne o pagamento antes de cancelar uma despesa paga.");
      resultId=expense.$id;
      if(expense.status==="cancelado"){
        await remove(T.expenses,expense.$id);
      }else{
        await update(T.expenses,expense.$id,{status:"cancelado",updated_at:now});
      }
    }else if(action==="deleteExpense"||action==="hardDeleteExpense"){
      const expense=await get(T.expenses,input.despesa_id);
      if(expense.status==="pago")throw new Error("Estorne o pagamento antes de excluir definitivamente uma despesa paga.");
      resultId=expense.$id;await remove(T.expenses,expense.$id);
    }else if(action==="payExpense"){
      const expense=await get(T.expenses,input.despesa_id);if(expense.status==="pago")throw new Error("Esta despesa já está paga.");if(expense.status==="cancelado")throw new Error("Reative ou edite a despesa antes de efetuar o pagamento.");
      const value=positive(input.valor_pago),account=await get(T.accounts,input.conta_id);if(Number(account.saldo_atual)<value)throw new Error("Saldo insuficiente.");
      const paymentId=ID.unique(),movementId=ID.unique();resultId=paymentId;
      await create(T.payments,paymentId,{despesa_id:expense.$id,conta_id:account.$id,valor:value,data_pagamento:new Date(input.data_pagamento).toISOString(),comprovante_id:input.comprovante_id||"",observacao:input.observacao||"",created_by:userId,estornado:false,created_at:now,idempotency_key:idempotencyKey});
      await create(T.moves,movementId,{tipo:"saida",data:new Date(input.data_pagamento).toISOString(),descricao:`Pagamento: ${expense.descricao}`,categoria_id:expense.categoria_id||"",conta_id:account.$id,conta_destino_id:"",valor:value,observacao:input.observacao||"",comprovante_id:input.comprovante_id||"",despesa_id:expense.$id,pagamento_id:paymentId,created_by:userId,idempotency_key:`m-${idempotencyKey}`.slice(0,36),created_at:now});
      await update(T.accounts,account.$id,{saldo_atual:Number(account.saldo_atual)-value,updated_at:now});await update(T.expenses,expense.$id,{status:"pago",conta_id:account.$id,data_pagamento:new Date(input.data_pagamento).toISOString(),comprovante_id:input.comprovante_id||"",updated_at:now});
    }else if(action==="reverseExpensePayment"){
      const payment=await get(T.payments,input.pagamento_id);if(payment.estornado)throw new Error("Este pagamento já foi estornado.");const account=await get(T.accounts,payment.conta_id),expense=await get(T.expenses,payment.despesa_id);
      resultId=ID.unique();await update(T.accounts,account.$id,{saldo_atual:Number(account.saldo_atual)+Number(payment.valor),updated_at:now});await update(T.payments,payment.$id,{estornado:true,estornado_at:now});await update(T.expenses,expense.$id,{status:"pendente",data_pagamento:"",updated_at:now});
      await create(T.moves,resultId,{tipo:"estorno",data:now,descricao:`Estorno: ${expense.descricao}`,categoria_id:expense.categoria_id||"",conta_id:account.$id,conta_destino_id:"",valor:Number(payment.valor),observacao:input.observacao||"",comprovante_id:"",despesa_id:expense.$id,pagamento_id:payment.$id,created_by:userId,idempotency_key:`m-${idempotencyKey}`.slice(0,36),created_at:now});
    }else throw new Error("Ação financeira inválida.");
    await create(T.ops,idempotencyKey,{action,user_id:userId,result_id:resultId,created_at:now});await db.updateTransaction({transactionId:tid,commit:true});return res.json({ok:true,id:resultId,action});
  }catch(e){error(e.message);return res.json({error:e.message||"Erro interno."},400)}
};
