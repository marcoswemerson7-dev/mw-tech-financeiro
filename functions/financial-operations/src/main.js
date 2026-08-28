import { Client, ID, TablesDB } from "node-appwrite";
const T={accounts:"contas_financeiras",moves:"movimentacoes_financeiras",expenses:"despesas",payments:"pagamentos_despesas",ops:"operacoes_idempotentes"};
export default async ({req,res,error})=>{
  const userId=req.headers["x-appwrite-user-id"];
  if(!userId)return res.json({error:"Usuário não autenticado."},401);
  let input;try{input=JSON.parse(req.body||"{}");}catch{return res.json({error:"JSON inválido."},400)}
  const {action,idempotencyKey}=input;
  if(!idempotencyKey)return res.json({error:"Chave de idempotência obrigatória."},400);
  const client=new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
  const db=new TablesDB(client),databaseId=process.env.APPWRITE_DATABASE_ID;
  try{
    try{const done=await db.getRow({databaseId,tableId:T.ops,rowId:idempotencyKey});return res.json({ok:true,id:done.result_id,replayed:true})}catch(e){if(e.code!==404)throw e}
    const tx=await db.createTransaction();const tid=tx.$id,now=new Date().toISOString();
    const get=(tableId,rowId)=>db.getRow({databaseId,tableId,rowId,transactionId:tid});
    const update=(tableId,rowId,data)=>db.updateRow({databaseId,tableId,rowId,data,transactionId:tid});
    const create=(tableId,rowId,data)=>db.createRow({databaseId,tableId,rowId,data,transactionId:tid});
    const positive=v=>{v=Number(v);if(!Number.isFinite(v)||v<=0)throw new Error("O valor deve ser maior que zero.");return v};
    let resultId="";
    if(action==="registerMovement"||action==="transfer"){
      const value=positive(input.valor),origin=await get(T.accounts,input.conta_id);
      const transfer=action==="transfer",out=input.tipo==="saida"||transfer;
      if(out&&Number(origin.saldo_atual)<value)throw new Error("Saldo insuficiente.");
      await update(T.accounts,origin.$id,{saldo_atual:Number(origin.saldo_atual)+(out?-value:value),updated_at:now});
      if(transfer){if(!input.conta_destino_id||input.conta_destino_id===origin.$id)throw new Error("Informe uma conta de destino diferente.");const dest=await get(T.accounts,input.conta_destino_id);await update(T.accounts,dest.$id,{saldo_atual:Number(dest.saldo_atual)+value,updated_at:now});}
      resultId=ID.unique();await create(T.moves,resultId,{tipo:transfer?"transferencia":input.tipo,data:new Date(input.data).toISOString(),descricao:input.descricao,categoria_id:input.categoria_id||"",conta_id:origin.$id,conta_destino_id:input.conta_destino_id||"",valor:value,observacao:input.observacao||"",comprovante_id:input.comprovante_id||"",despesa_id:"",pagamento_id:"",created_by:userId,idempotency_key:idempotencyKey,created_at:now});
    }else if(action==="payExpense"){
      const expense=await get(T.expenses,input.despesa_id);if(expense.status==="pago")throw new Error("Esta despesa já está paga.");
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
    await create(T.ops,idempotencyKey,{action,user_id:userId,result_id:resultId,created_at:now});await db.updateTransaction({transactionId:tid,commit:true});return res.json({ok:true,id:resultId});
  }catch(e){error(e.message);return res.json({error:e.message||"Erro interno."},400)}
};
