import { Client, ID, Query, TablesDB } from "node-appwrite";
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
    const remove=(tableId,rowId)=>db.deleteRow({databaseId,tableId,rowId,transactionId:tid});
    const positive=v=>{v=Number(v);if(!Number.isFinite(v)||v<=0)throw new Error("O valor deve ser maior que zero.");return v};
    const applyEffect=async(move,sign=1)=>{
      const value=positive(move.valor),origin=await get(T.accounts,move.conta_id);
      const transfer=move.tipo==="transferencia",out=move.tipo==="saida"||transfer;
      const delta=(out?-value:value)*sign;
      const next=Number(origin.saldo_atual)+delta;
      if(next<0)throw new Error("Saldo insuficiente para concluir a alteração.");
      await update(T.accounts,origin.$id,{saldo_atual:next,updated_at:now});
      if(transfer){
        if(!move.conta_destino_id||move.conta_destino_id===origin.$id)throw new Error("Informe uma conta de destino diferente.");
        const dest=await get(T.accounts,move.conta_destino_id);
        const destNext=Number(dest.saldo_atual)+(value*sign);
        if(destNext<0)throw new Error("Saldo insuficiente na conta de destino para desfazer a transferência.");
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
        const payment=await get(T.payments,move.pagamento_id);
        if(!payment.estornado)throw new Error("Estorne o pagamento antes de excluir esta movimentação.");
        resultId=move.$id;await remove(T.moves,move.$id);
      }else if(move.despesa_id){
        const linkedMoves=await db.listRows({databaseId,tableId:T.moves,queries:[Query.equal("despesa_id",move.despesa_id)],transactionId:tid});
        const linkedPayments=await db.listRows({databaseId,tableId:T.payments,queries:[Query.equal("despesa_id",move.despesa_id)],transactionId:tid});
        if(linkedPayments.rows.some(payment=>!payment.estornado))throw new Error("Estorne o pagamento antes de excluir esta movimentação.");
        resultId=move.$id;
        for(const linked of linkedMoves.rows)await remove(T.moves,linked.$id);
        for(const payment of linkedPayments.rows)await remove(T.payments,payment.$id);
      }
      else{
      await applyEffect(move,-1);resultId=move.$id;await remove(T.moves,move.$id);
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
