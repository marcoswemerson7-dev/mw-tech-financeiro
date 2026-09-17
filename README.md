# MW TECH Control

Plataforma administrativa geral da MW TECH construída com React, TypeScript, Vite, Tailwind CSS e Appwrite.

## Configuração

1. Copie `.env.example` para `.env.local` e informe os IDs públicos do Appwrite.
2. Confira o banco `mw-tech-financeiro`, o bucket `comprovantes` e as Functions descritas em `APPWRITE_SETUP.md`.
3. Crie o primeiro usuário administrador em Auth > Users.
4. Execute `npm install`, `npm run build` e `npm run dev`.

O frontend usa somente variáveis `VITE_APPWRITE_*`, que são públicas. Nunca adicione `APPWRITE_API_KEY` ou qualquer segredo ao `.env`, `.env.local` versionado ou ao GitHub.\n<!-- deployment trigger: monitoring rollout 2026-09-17 -->\n