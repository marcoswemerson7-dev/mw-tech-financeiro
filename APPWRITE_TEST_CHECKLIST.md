# Checklist de validação Appwrite

Status desta entrega: testes locais estáticos concluídos; testes reais de nuvem aguardam Project ID e credenciais do projeto Appwrite.

| Fluxo | Status | Evidência/pendência |
|---|---|---|
| Build de produção | PASSOU | `npm run build` concluído |
| Login | PENDENTE | exige usuário no Appwrite Cloud |
| Logout | PENDENTE | exige sessão real |
| Recuperação/persistência de sessão | PENDENTE | exige sessão real |
| Criar conta financeira | PENDENTE | exige database provisionado |
| Cadastrar saldo inicial | PENDENTE | exige database provisionado |
| Registrar entrada | PENDENTE | exige Function publicada |
| Registrar saída | PENDENTE | exige Function publicada |
| Transferir entre contas | PENDENTE | exige Function publicada |
| Cadastrar despesa | PENDENTE | exige database provisionado |
| Marcar despesa como paga | PENDENTE | exige Function publicada |
| Impedir pagamento duplicado | PENDENTE | exige teste concorrente na Function |
| Anexar PDF/JPG/JPEG/PNG | PENDENTE | exige bucket provisionado |
| Estornar pagamento | PENDENTE | exige Function publicada |
| Gerar despesa recorrente | PENDENTE | exige segunda Function publicada |
| Mudança de competência/mês | PENDENTE | exige teste com dados controlados |
| Relatório por período | PENDENTE | exige dados reais de teste |
| Atualização correta dos saldos | PENDENTE | exige sequência entrada/saída/transferência/pagamento/estorno |

Use somente `PASSOU` ou `FALHOU` após executar cada fluxo no projeto Cloud. Não marque como aprovado com base apenas no build.
