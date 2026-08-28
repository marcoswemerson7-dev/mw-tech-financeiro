# MW TECH Financeiro

Sistema interno de gestão financeira construído com React, TypeScript, Vite, Tailwind CSS e Supabase.

## Configuração

1. Copie `.env.example` para `.env` e informe a URL e a chave anônima do projeto Supabase.
2. Execute a migration em `supabase/migrations` no projeto Supabase.
3. Crie o primeiro usuário administrador em Authentication > Users.
4. Execute `npm install` e `npm run dev`.

O frontend usa exclusivamente a chave anônima. Nunca adicione uma chave `service_role` ao `.env`.
