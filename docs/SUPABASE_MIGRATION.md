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
