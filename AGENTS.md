<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regra Obrigatória de Versionamento (FII Tracker)

Sempre que qualquer alteração, correção de bug ou melhoria for aplicada neste projeto:
1. **Incremente obrigatoriamente a versão** (`APP_VERSION`) no arquivo `src/lib/version.ts` (ex: `1.3.0` -> `1.3.1` ou `1.4.0`), atualize a data `APP_UPDATED_AT` e adicione o resumo da mudança no topo de `APP_CHANGELOG`.
2. Mantenha o campo `"version"` em `package.json` sincronizado com `APP_VERSION`.

