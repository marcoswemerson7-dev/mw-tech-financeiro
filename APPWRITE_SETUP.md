# Configuração do Appwrite Cloud — MW TECH Financeiro

O Appwrite foi adicionado em paralelo. Os arquivos e migrations do Supabase continuam no repositório apenas como histórico e fallback técnico; nenhuma chave administrativa é usada no navegador.

## 1. Criar o projeto

1. Acesse o Appwrite Cloud e crie o projeto `MW TECH Financeiro`.
2. Em **Platforms**, adicione uma aplicação Web.
3. Em desenvolvimento, use o hostname `localhost`. No deploy, adicione também o domínio da Vercel.
4. Copie o **Project ID**.

## 2. Provisionar Database, tabelas e Storage

Crie uma API Key temporária no Console com acesso a Databases/TablesDB e Storage. Ela será usada somente pelo script local e nunca deve receber prefixo `VITE_`.

No PowerShell:

```powershell
$env:APPWRITE_ENDPOINT="https://cloud.appwrite.io/v1"
$env:APPWRITE_PROJECT_ID="SEU_PROJECT_ID"
$env:APPWRITE_API_KEY="SUA_CHAVE_TEMPORARIA"
$env:APPWRITE_DATABASE_ID="mw-tech-financeiro"
npm run appwrite:setup
Remove-Item Env:APPWRITE_API_KEY
```

O script cria:

- database `mw-tech-financeiro`;
- tabelas `profiles`, `contas_financeiras`, `categorias_financeiras`, `movimentacoes_financeiras`, `despesas`, `despesas_recorrencias`, `pagamentos_despesas`, `configuracoes_empresa` e `operacoes_idempotentes`;
- índices de consulta e unicidade;
- bucket privado `comprovantes`, limitado a 10 MB e às extensões PDF/JPG/JPEG/PNG;
- permissões somente para usuários autenticados.

Após o setup, revogue a API Key temporária. Se o Console ainda estiver finalizando a criação de colunas/índices, aguarde até todos aparecerem como disponíveis antes do primeiro acesso.

## 3. Criar o administrador

No Console, abra **Auth > Users > Create user** e cadastre seu e-mail e senha. Não há cadastro público no frontend. Opcionalmente, crie uma linha em `profiles` usando o ID desse usuário.

## 4. Configurar o frontend

Copie `.env.example` para `.env` e preencha somente valores públicos:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=SEU_PROJECT_ID
VITE_APPWRITE_DATABASE_ID=mw-tech-financeiro
VITE_APPWRITE_COMPROVANTES_BUCKET_ID=comprovantes
VITE_APPWRITE_FINANCIAL_FUNCTION_ID=financial-operations
```

Nunca coloque `APPWRITE_API_KEY` ou qualquer segredo em variável iniciada por `VITE_`.

## 5. Configurar as Functions

Para respeitar o limite gratuito de duas Functions, as operações críticas foram agrupadas:

1. `financial-operations`: diretório `functions/financial-operations`, ações `registerMovement`, `transfer`, `payExpense` e `reverseExpensePayment`.
2. `recurring-expenses`: diretório `functions/recurring-expenses`, gera uma despesa independente por competência e ignora a competência já existente.

Crie as duas Functions no Console com runtime Node.js, aponte cada uma para seu diretório e use `npm install` como comando de build. Configure nelas, como segredos:

```text
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=SEU_PROJECT_ID
APPWRITE_DATABASE_ID=mw-tech-financeiro
APPWRITE_API_KEY=CHAVE_EXCLUSIVA_DA_FUNCTION
```

A chave das Functions deve ter acesso a TablesDB. Permita execução apenas para `users`. O Appwrite envia o cabeçalho `x-appwrite-user-id`; a Function rejeita chamadas sem usuário autenticado.

## 6. Segurança financeira

As operações usam transações do TablesDB para gravar saldo e histórico de forma conjunta. Cada chamada recebe uma chave de idempotência; índices únicos impedem o mesmo pagamento ou movimento de ser aplicado duas vezes. Pagamentos estornados são preservados, nunca excluídos.

## 7. Executar e publicar

```bash
npm install
npm run build
npm run dev
```

Na Vercel, importe o repositório e cadastre as mesmas variáveis `VITE_APPWRITE_*`. O computador pode ficar desligado depois que frontend e backend estiverem publicados.

## 8. Legado

`clientes`, `receitas` e `retiradas` não foram duplicados no Appwrite nesta etapa. O novo razão financeiro já representa entradas, saídas e retiradas por tipo. As rotas legadas permanecem no código durante a transição, mas devem ser revisadas antes da remoção definitiva do Supabase.
