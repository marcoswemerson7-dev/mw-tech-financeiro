# Migração controlada: Appwrite → Supabase

**Projeto de destino:** `qclawbwfrqcwtegkvkmy` (MW TECH CONTROL). **Estado:** somente preparação; não ativado em produção.

## Diagnóstico do código (03/11/2026)
- O app usa `src/lib/auth.tsx` e `src/services/auth.ts` com autenticação Appwrite; IDs de usuário do Appwrite **não** equivalem a UUIDs do Supabase Auth.
- `src/services/despachanteSync.ts` armazena snapshot em blocos na tabela Appwrite `despachante_dados`. O módulo também possui armazenamento local `mw-despachante-organizado-v2`.
- `src/services/agendaSync.ts` armazena snapshot em blocos na tabela Appwrite `agenda_dados`; `src/pages/Agenda.tsx` mantém compromissos, páginas, escrita à mão e tarefas localmente. Sincronização atual é manual.
- `src/services/managedSystems.ts` lê `sistemas_orgaos` via função Appwrite e tem fallback na tabela `partes_financeiras`.
- O financeiro possui funções Appwrite com transações e idempotência; **não** trocar por simples INSERTs no navegador.

## Etapas antes de apontar a produção
1. Fazer backup dos dados do Appwrite (TablesDB, Auth, Storage e Functions relevantes) e exportar JSON dos dados locais da Agenda e Despachante em cada dispositivo que contenha registros exclusivos.
2. Criar contas equivalentes no Supabase Auth, com troca segura de senha, e manter mapeamento explícito `appwrite_user_id → supabase_auth_user_id`. Não copiar hashes ou senhas e não misturar IDs.
3. Reconciliar e deduplicar clientes, checklists e processos; validar vínculos e conflitos entre snapshots dos dispositivos. Preservar os IDs de origem como metadados.
4. Implementar esquema relacional definitivo, RLS por usuário/organização, Storage privado, operações financeiras atômicas e idempotentes e trilha de auditoria.
5. Importar cópia dos dados para staging, comparar contagens e amostras e validar leitura/escrita num ambiente de teste. Não sobrescrever a única cópia.
6. Alterar frontend e backend numa branch separada; executar build, testes de autenticação, RLS, permissões, financeira, sincronização PC/tablet/celular e rollback.
7. Após testes e backup final, mudar variáveis públicas de deploy e efetivar o corte em produção; manter Appwrite disponível para rollback até aprovação.

## Staging criado
`public.mw_control_snapshots` contém somente snapshots JSON vinculados a `auth.users` com RLS por usuário. Sua existência **não** faz migração, sincronização ou autenticação automaticamente. Nunca expor `service_role` / secret key no frontend. Nenhum registro foi importado até o momento.

## Etapa 3 — Financeiro (preparado em 03/11/2026)
- Tabelas criadas no Supabase: `mw_financial_accounts`, `mw_financial_categories`, `mw_financial_expenses`, `mw_financial_movements`, `mw_financial_payments`.
- O vínculo entre usuários Appwrite e Supabase ficará em `mw_legacy_user_map`; esta tabela **não concede acesso ao navegador**, mesmo com RLS ativado.
- Todas as cinco tabelas financeiras têm **somente SELECT** autenticado, filtrado por `owner_id`. INSERT/UPDATE/DELETE permanecem revogados até existir operação financeira transacional do lado do servidor.
- Os valores monetários serão armazenados em **centavos inteiros** para evitar erros de arredondamento. Importação deve comparar saldos de abertura, movimentos por conta, pagamentos e estornos, sem reconstruir saldos a partir de linhas parciais.
- A tabela `mw_legacy_user_map` gera uma observação informativa `rls_enabled_no_policy`: é deliberado, pois não existem políticas nem grants para o browser.
- O banco foi atualizado por `apply_migration` sob o nome `create_financial_read_only_migration_destination`. A migração aplicada consta no histórico do Supabase; não reaplicar automaticamente no mesmo projeto.

## Exportação e conferência (ramificação, não publicada)
- `src/services/financialMigrationExport.ts`: percorre páginas de 100 registros das tabelas Appwrite que o usuário conectado pode ler. Cada tabela registra sucesso ou erro; uma leitura parcial é marcada como erro.
- `src/services/migrationBackup.ts`: inclui financeiro, Agenda, Despachante e armazenamento local no JSON; não move os dados para Supabase e não altera Appwrite.
- `src/services/migrationAudit.ts`: valida contagens, IDs duplicados e referências de clientes, processos, checklists, contas, pagamentos e despesas. A validação é preliminar, não substitui a conferência de saldos e anexos.
- Acessos administrativos de `sistemas_orgaos` / `usuarios_acessos` podem não permitir leitura direta; esses erros devem ser resolvidos por exportação administrativa segura.
- **NÃO exporta arquivos binários** de Storage, senhas, dados de sessões Auth ou dados locais de outros aparelhos.
- Como o backup contém dados pessoais e financeiros, mantê-lo criptografado e não enviá-lo a repositórios públicos nem mensagens desnecessárias.

## Aceitação obrigatória para ativação
1. Backup do Appwrite conferido e exportado com permissões administrativas, incluindo arquivos do Storage e usuários.
2. Mapeamento aprovado de usuários, IDs antigos e novos, com política de acesso por empresa.
3. Comparação de contagem por tabela e valores centavo a centavo, com relatório de divergências.
4. Funções transacionais criadas para lançamentos, transferências, despesas, pagamentos, estornos e idempotência.
5. Testes de RLS, permissões, login e sincronização multi-dispositivo sem perdas.
6. Build de produção e testes em ambiente separado; só então mudança de deploy.

## Etapa 4 — Validação automatizada da migração (03/11/2026)
- Verificador preliminar compara também o snapshot do Despachante salvo no navegador com a cópia no Appwrite, apontando registros presentes exclusivamente no dispositivo.
- Para contas financeiras exportadas, recalcula o saldo a partir de saldo inicial e movimentações, com precisão de centavos inteiros, e aponta divergências para revisão. **Não corrige nem altera saldos automaticamente.**
- `tests/migrationAudit.test.ts`: testes de vínculo quebrado, registro local exclusivo, soma exata de centavos e exportação incompleta.
- `npm run test:migration` executa a suíte. O workflow `.github/workflows/migration-validation.yml` solicita teste e build nos pull requests correspondentes.
- O verificador tem caráter **preliminar**: não pode declarar a migração pronta sem extratos completos do Appwrite, documentos de Storage, usuários Auth e reconciliação entre todos os aparelhos.
- **Status:** testes definidos no GitHub, mas a execução deve ser confirmada pelos checks. O importador definitivo ainda não foi ativado.

## Definição atual: sistema completo, sem página de teste
- A rota temporária de autenticação independente foi removida da branch a pedido do proprietário.
- A única experiência de login desejada é `/login`, que deve abrir a aplicação normal após autenticação bem-sucedida.
- O Monitoramento e a Central de Suporte dependem da sessão/JWT Appwrite; o Financeiro também chama tabelas e funções Appwrite. Essas dependências exigem adaptação segura antes de substituir o provedor global de autenticação.
- Mudança de Supabase Auth isolada sem implementar adaptação desses serviços **não** é uma migração funcional. Não publicar nem mesclar um login que esconda módulos quebrados.
- MW Despachante deve utilizar o Supabase com preservação de vínculos entre clientes, checklists e processos; Financeiro deve manter valores e lançamentos do Appwrite na migração. Não alterar aparência, funcionalidades nem monitoramento.
- Critérios de aceite: login Supabase no `/login`, dashboard acessível, Financeiro exibindo valores preservados, Monitoramento e Suporte funcionais, MW Despachante com leitura/escrita e sincronização entre dispositivos, logout e RLS corretos.
